const ACCESS_TOKEN_KEY = "domicoop_access_token"
const REFRESH_TOKEN_KEY = "domicoop_refresh_token"

/**
 * Tokens live in localStorage, which does not exist on the server.
 *
 * The app is configured as an SPA (see vite.config.ts) so these are normally
 * only reached from the browser — but the module is imported by auth-storage,
 * which the router DOES evaluate during SSR and prerendering. An unguarded
 * `localStorage` there is a ReferenceError that takes down the whole render,
 * so every accessor goes through here. `getStoredAuth()` has always guarded
 * this way; these did not.
 */
function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage
}

export const session = {
  async getToken(): Promise<string | null> {
    return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null
  },

  async getRefreshToken(): Promise<string | null> {
    return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    const s = storage()
    if (!s) return
    s.setItem(ACCESS_TOKEN_KEY, accessToken)
    s.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },

  async clearTokens(): Promise<void> {
    const s = storage()
    if (!s) return
    s.removeItem(ACCESS_TOKEN_KEY)
    s.removeItem(REFRESH_TOKEN_KEY)
  },

  async touch(): Promise<void> {
    // no-op in this project; used to update last-activity timestamps
  },
}
