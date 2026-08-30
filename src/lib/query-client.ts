import { QueryClient } from "@tanstack/react-query"

/**
 * One QueryClient for the app.
 *
 * Created lazily rather than at module scope so a reload in dev does not hand
 * two clients to two provider trees.
 *
 * Defaults are tuned for an admin console rather than a public site: several
 * people work the same records at once, so `refetchOnWindowFocus` earns its
 * keep — coming back to a tab should show what the other admin just did. The
 * 30s `staleTime` stops that turning into a refetch on every alt-tab.
 */
let client: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (client) return client
  client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // One retry: a genuine 4xx will not fix itself, and admins would
        // rather see the error than watch a spinner through three attempts.
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
  return client
}

/**
 * Query keys in one place so a mutation can invalidate exactly what it
 * changed. Scattered string arrays are how "why didn't the table update"
 * bugs start.
 */
export const queryKeys = {
  members: (page: number) => ["members", page] as const,
  membersPending: () => ["members", "pending"] as const,
  member: (id: string) => ["member", id] as const,
  memberStatement: (id: string, year: number) =>
    ["member", id, "statement", year] as const,
  loans: (page: number, status?: string) =>
    ["loans", page, status ?? "all"] as const,
  loanDetail: (id: string) => ["loan", id] as const,
  contributions: (page: number, year?: number) =>
    ["contributions", page, year ?? "all"] as const,
  dividends: (year: number) => ["dividends", year] as const,
  announcements: () => ["announcements"] as const,
  admins: () => ["admins"] as const,
  registrationWindows: () => ["registration", "windows"] as const,
  registrationApplications: (id: string) =>
    ["registration", "windows", id, "applications"] as const,
  reportSummary: () => ["reports", "summary"] as const,
  messages: () => ["messages"] as const,
  notificationPreferences: () => ["notifications", "preferences"] as const,
} as const
