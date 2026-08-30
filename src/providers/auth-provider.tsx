import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react"
import { authApi } from "../lib/api/auth"
import { adminsApi } from "../lib/api/admins"
import { session } from "../lib/session"
import { ApiError } from "../lib/http"
import {
  getStoredAuth,
  setStoredUser,
  clearStoredAuth,
  displayNameFromEmail,
  SESSION_ENDED_EVENT,
  type AdminUser,
} from "../lib/auth-storage"

interface LoginResult {
  ok: boolean
  error?: string
}

interface AuthContextType {
  user: AdminUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // A session can end without anyone pressing "log out" — an expired refresh
  // token ends it from inside the HTTP layer. Listen for that so the UI drops
  // the admin immediately instead of leaving them on a page whose every
  // request 401s.
  useEffect(() => {
    const onSessionEnded = () => setUser(null)
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded)
  }, [])

  useEffect(() => {
    const { user: storedUser } = getStoredAuth()
    setUser(storedUser)
    setIsLoading(false)
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setIsLoading(true)
      try {
        const res = await authApi.login({ email, password })

        // Gate the admin portal on role (§2). A member authenticates fine but
        // every admin route 403s, so reject them here with a clear message.
        if (res.user.role !== "admin") {
          await session.clearTokens()
          clearStoredAuth()
          return {
            ok: false,
            error: "This account does not have admin access.",
          }
        }

        await session.setTokens(res.access_token, res.refresh_token)

        // Fetch the admin profile to get the authoritative full_name.
        let fullName = res.user.full_name
        let avatarUrl = res.user.avatar_url
        let officerRole: "secretary" | "president" | null = null
        try {
          const profiles = await adminsApi.list()
          const profile = profiles.find((p) => p.email === res.user.email)
          if (profile) {
            fullName = profile.full_name
            avatarUrl = profile.avatar_url ?? undefined
            officerRole = profile.officer_role
          }
        } catch {
          // Admin list endpoint unavailable; fall through to login-response values.
        }

        const adminUser: AdminUser = {
          id: res.user.id,
          email: res.user.email,
          role: res.user.role,
          name: fullName || displayNameFromEmail(res.user.email),
          avatar_url: avatarUrl,
          officer_role: officerRole,
        }
        setStoredUser(adminUser)
        setUser(adminUser)
        return { ok: true }
      } catch (err) {
        const error =
          err instanceof ApiError
            ? err.message
            : "Unable to sign in. Please try again."
        return { ok: false, error }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout()
    } catch {
      // best-effort — clear local state regardless
    }
    await session.clearTokens()
    clearStoredAuth()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
