import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { queryKeys } from "./query-client"
import { membersApi } from "./api/members"
import { loansApi } from "./api/loans"
import { contributionsApi } from "./api/contributions"
import { dividendsApi } from "./api/dividends"
import { announcementsApi } from "./api/announcements"
import { adminsApi } from "./api/admins"
import { registrationApi } from "./api/registration"
import { reportsApi } from "./api/reports"
import { messagesApi } from "./api/messages"
import { notificationsApi } from "./api/notifications"
import type { Member } from "./types/auth"
import type { Contribution } from "./types/contributions"
import type { Announcement } from "./types/announcements"
import type { ProcessLoanInput, SignLoanInput } from "./types/loans"

/**
 * Data access for the admin app.
 *
 * Every page used to carry its own `useState` for rows/loading/error, a
 * `useCallback` fetcher, a `useEffect` to call it, and a manual re-fetch after
 * each mutation. That is ~40 lines per page of identical plumbing, and it made
 * every action cost a full round trip plus a table refresh.
 *
 * Query owns that now: one hook per resource, and mutations that invalidate
 * exactly the keys they touched (see `queryKeys`).
 */

// ---------------------------------------------------------------- members --

export function useMembers(page: number, limit: number) {
  return useQuery({
    queryKey: queryKeys.members(page),
    queryFn: () => membersApi.list({ page, limit }),
  })
}

export function usePendingApplications() {
  return useQuery({
    queryKey: queryKeys.membersPending(),
    queryFn: () => membersApi.getPendingApplications(),
  })
}

export function useMember(id: string) {
  return useQuery({
    queryKey: queryKeys.member(id),
    queryFn: () => membersApi.getById(id),
    enabled: !!id,
  })
}

export function useMemberStatement(id: string, year: number) {
  return useQuery({
    queryKey: queryKeys.memberStatement(id, year),
    queryFn: () => membersApi.getStatement(id, { year }),
    enabled: !!id,
  })
}

/** Approving mints a member number server-side, so the row is patched from the response. */
export function useApproveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => membersApi.approve(id),
    onMutate: (id) => optimisticallyPatchMember(qc, id, { status: "active" }),
    onError: (_e, _id, ctx) => rollback(qc, ctx),
    onSuccess: (updated) => {
      patchMemberEverywhere(qc, updated)
      qc.invalidateQueries({ queryKey: queryKeys.membersPending() })
      // The registration page lists the same people as an intake's applicants,
      // so approving from there has to refresh that list too — without this
      // the row stays "pending" until a manual reload.
      qc.invalidateQueries({ queryKey: ["registration"] })
    },
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Member> }) =>
      membersApi.updateById(id, data as never),
    onMutate: ({ id, data }) => optimisticallyPatchMember(qc, id, data),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSuccess: (updated) => patchMemberEverywhere(qc, updated),
  })
}

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: membersApi.create,
    // A new row's placement depends on the server's ordering, so this refetches
    // rather than guessing where it belongs.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  })
}

// ------------------------------------------------------------------ loans --

export function useLoans(page: number, limit: number, status?: string) {
  return useQuery({
    queryKey: queryKeys.loans(page, status),
    queryFn: () => loansApi.list({ page, limit, status }),
  })
}

export function useLoanDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.loanDetail(id ?? ""),
    queryFn: () => loansApi.getDetail(id!),
    enabled: !!id,
  })
}

export function useProcessLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProcessLoanInput }) =>
      loansApi.process(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ["loans"] })
      qc.invalidateQueries({ queryKey: queryKeys.loanDetail(id) })
    },
  })
}

/** Signing can flip a loan to approved and generate a bond, so both keys go. */
export function useSignLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SignLoanInput }) =>
      loansApi.sign(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ["loans"] })
      qc.invalidateQueries({ queryKey: queryKeys.loanDetail(id) })
    },
  })
}

export function useDisburseLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => loansApi.disburse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  })
}

// ---------------------------------------------------------- contributions --

export function useContributions(page: number, limit: number, year?: number) {
  return useQuery({
    queryKey: queryKeys.contributions(page, year),
    queryFn: () => contributionsApi.list({ page, limit, year }),
  })
}

export function useUpdateContributionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: Contribution["payment_status"]
    }) => contributionsApi.updateStatus(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["contributions"] })
      const previous = qc.getQueriesData({ queryKey: ["contributions"] })
      qc.setQueriesData({ queryKey: ["contributions"] }, (old: any) =>
        !old?.data
          ? old
          : {
              ...old,
              data: old.data.map((c: Contribution) =>
                c.id === id ? { ...c, payment_status: status } : c
              ),
            }
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: ["contributions"] }),
  })
}

// -------------------------------------------------------------- dividends --

export function useDividends(year: number) {
  return useQuery({
    queryKey: queryKeys.dividends(year),
    queryFn: () => dividendsApi.list({ year }),
  })
}

// ---------------------------------------------------------- announcements --

export function useAnnouncements() {
  return useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => announcementsApi.getAll(),
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Announcement> }) =>
      announcementsApi.update(id, data as never),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.announcements() })
      const previous = qc.getQueriesData({
        queryKey: queryKeys.announcements(),
      })
      qc.setQueryData(
        queryKeys.announcements(),
        (old: Announcement[] | undefined) =>
          old?.map((a) => (a.id === id ? { ...a, ...data } : a))
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.announcements() }),
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.announcements() })
      const previous = qc.getQueriesData({
        queryKey: queryKeys.announcements(),
      })
      qc.setQueryData(
        queryKeys.announcements(),
        (old: Announcement[] | undefined) => old?.filter((a) => a.id !== id)
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.announcements() }),
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: announcementsApi.create,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.announcements() }),
  })
}

// ------------------------------------------------------- admins / windows --

export function useAdmins() {
  return useQuery({
    queryKey: queryKeys.admins(),
    queryFn: () => adminsApi.list(),
  })
}

export function useSetOfficerRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      officer_role,
    }: {
      id: string
      officer_role: "secretary" | "president" | null
    }) => adminsApi.setOffice(id, officer_role),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admins() }),
  })
}

export function useRegistrationWindows() {
  return useQuery({
    queryKey: queryKeys.registrationWindows(),
    queryFn: () => registrationApi.listWindows(),
  })
}

export function useRegistrationApplications(windowId: string | null) {
  return useQuery({
    queryKey: queryKeys.registrationApplications(windowId ?? ""),
    queryFn: () => registrationApi.listApplications(windowId!),
    enabled: !!windowId,
  })
}

export function useMessages() {
  return useQuery({
    queryKey: queryKeys.messages(),
    queryFn: () => messagesApi.list(),
  })
}

export function useReplyToMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      messagesApi.reply(id, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.messages() }),
  })
}

export function useUpdateMessageStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      messagesApi.updateStatus(id, { status } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.messages() }),
  })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences(),
    queryFn: () => notificationsApi.getPreferences(),
  })
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: (updated) =>
      qc.setQueryData(queryKeys.notificationPreferences(), updated),
  })
}

export function useCreateAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admins() }),
  })
}

export function useRevokeAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminsApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admins() }),
  })
}

export function useCreateRegistrationWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: registrationApi.createWindow,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.registrationWindows() }),
  })
}

export function useUpdateRegistrationWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      registrationApi.updateWindow(id, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.registrationWindows() }),
  })
}

export function useOpenRegistrationWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => registrationApi.openWindow(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.registrationWindows() }),
  })
}

export function useCloseRegistrationWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => registrationApi.closeWindow(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.registrationWindows() }),
  })
}

export function useReportSummary() {
  return useQuery({
    queryKey: queryKeys.reportSummary(),
    queryFn: () => reportsApi.getSummary(),
  })
}

// ------------------------------------------------------------------ utils --

type Snapshot = { previous: [readonly unknown[], unknown][] }

/**
 * Restore whatever the optimistic update overwrote.
 *
 * Query hands the `onMutate` return value back to `onError`, so the snapshot
 * travels with the mutation rather than living in component state — which is
 * what makes rollback work even if the component unmounted mid-flight.
 */
function rollback(qc: QueryClient, ctx: unknown) {
  const snapshot = ctx as Snapshot | undefined
  snapshot?.previous?.forEach(([key, data]) =>
    qc.setQueryData(key as never, data as never)
  )
}

async function optimisticallyPatchMember(
  qc: QueryClient,
  id: string,
  patch: Partial<Member>
): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: ["members"] })
  const previous = qc.getQueriesData({ queryKey: ["members"] })
  qc.setQueriesData({ queryKey: ["members"] }, (old: any) => {
    if (Array.isArray(old)) {
      return old.map((m: Member) => (m.id === id ? { ...m, ...patch } : m))
    }
    if (!old?.data) return old
    return {
      ...old,
      data: old.data.map((m: Member) => (m.id === id ? { ...m, ...patch } : m)),
    }
  })
  return { previous: previous as Snapshot["previous"] }
}

/** The server's row is authoritative — it carries fields the guess could not know. */
function patchMemberEverywhere(qc: QueryClient, updated: Member) {
  qc.setQueriesData({ queryKey: ["members"] }, (old: any) => {
    if (Array.isArray(old)) {
      return old.map((m: Member) =>
        m.id === updated.id ? { ...m, ...updated } : m
      )
    }
    if (!old?.data) return old
    return {
      ...old,
      data: old.data.map((m: Member) =>
        m.id === updated.id ? { ...m, ...updated } : m
      ),
    }
  })
  qc.setQueryData(queryKeys.member(updated.id), updated)
}
