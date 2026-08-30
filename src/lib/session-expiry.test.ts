import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { authedRequest } from "./http"
import { session } from "./session"
import { getStoredAuth, setStoredUser, AUTH_STORAGE_KEY } from "./auth-storage"

/**
 * Minimal browser storage — vitest runs in node, where neither `window` nor
 * `localStorage` exists.
 *
 * Both are stubbed deliberately: `session.ts` reads `window.localStorage`
 * (so it degrades safely during SSR) while `auth-storage.ts` reads the bare
 * `localStorage` global. Stubbing only one makes this test pass for the wrong
 * reason — the token path silently no-ops and the refresh branch under test
 * never runs.
 */
function installLocalStorage() {
  const store = new Map<string, string>()
  const api = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
  vi.stubGlobal("localStorage", api)
  vi.stubGlobal("window", { localStorage: api, dispatchEvent: () => true })
  return store
}

describe("session expiry", () => {
  let store: Map<string, string>

  beforeEach(async () => {
    store = installLocalStorage()
    setStoredUser({ id: "a1", email: "admin@x.com", role: "admin", name: "Admin" })
    await session.setTokens("expired-access", "dead-refresh")
  })

  afterEach(() => vi.unstubAllGlobals())

  it("signs the admin out when the refresh token is no longer valid", async () => {
    // The access token has expired and the refresh token is rejected too —
    // the ordinary "I came back the next morning" case.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    )

    await expect(authedRequest("/v1/members/me")).rejects.toThrow()

    // Tokens are dropped — this part already works.
    expect(await session.getToken()).toBeNull()
    expect(await session.getRefreshToken()).toBeNull()

    // ...but the stored identity must go too, or the route guard keeps letting
    // them in while every request 401s: a signed-in-looking app that can do
    // nothing, and cannot recover without clearing site data by hand.
    expect(store.has(AUTH_STORAGE_KEY)).toBe(false)
    expect(getStoredAuth().isAuthenticated).toBe(false)
  })
})
