// Single source of truth for the persisted admin identity. The router context
// gate (__root.tsx / router.tsx) and the AuthProvider both read/write through
// here so they never drift apart.

import { session } from "./session"

export const AUTH_STORAGE_KEY = "domicoop_auth"

// Minimal admin identity we keep in localStorage. The login response (§2) is
// `{ id, email, role, email_verified }`; `name`/`avatar_url` are derived/optional
// and only used for the header chrome.
export interface AdminUser {
  id: string
  email: string
  role: string
  name: string
  avatar_url?: string
  /**
   * Cooperative office held, if any — drives whether the Sign action is
   * offered on a loan. Cached from the admin profile at login, so it can go
   * stale if an office is reassigned mid-session; that only affects which
   * buttons are enabled, since POST /loans/:id/sign re-checks server-side.
   */
  officer_role?: "secretary" | "president" | null
}

export interface StoredAuth {
  isAuthenticated: boolean
  user: AdminUser | null
}

export function getStoredAuth(): StoredAuth {
  if (typeof window === "undefined")
    return { isAuthenticated: false, user: null }
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as { user?: AdminUser | null }
      return { isAuthenticated: !!parsed.user, user: parsed.user ?? null }
    }
  } catch {}
  return { isAuthenticated: false, user: null }
}

export function setStoredUser(user: AdminUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

/** Dispatched when a session ends, so the UI can react without a page reload. */
export const SESSION_ENDED_EVENT = "domicoop:session-ended"

/**
 * End the session completely — tokens AND the stored identity.
 *
 * A session lives in two places: the tokens in `session`, and the identity
 * under AUTH_STORAGE_KEY that the route guard reads. Clearing only one leaves
 * the app signed-in-looking but unable to do anything: `_authenticated`
 * happily admits the admin, then every request fails 401 with no way back to
 * the login page short of clearing site data by hand.
 *
 * That is exactly what happened when a refresh token expired, because the 401
 * path in `http.ts` cleared tokens and nothing else. Both stores are torn down
 * here, together, so they cannot drift apart again — call this rather than
 * either clearer on its own.
 */
export async function endSession(): Promise<void> {
  await session.clearTokens()
  clearStoredAuth()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT))
  }
}

// Derive a display name from a login user that has no profile name of its own.
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}
