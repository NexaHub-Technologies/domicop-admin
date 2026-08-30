/**
 * Paystack's settlement state for a contribution. Stored on
 * `contributions.payment_status` — there is no `status` column; the original
 * one ("pending" | "verified" | "rejected") was dropped in
 * 20260414000001_modify_contributions_schema.sql.
 */
export type ContributionPaymentStatus =
  | "success"
  | "pending"
  | "failed"
  | "abandoned"

/**
 * A contribution exactly as `GET /v1/contributions/` returns it:
 * `select("*, profiles(full_name, member_no)")`.
 *
 * Note two sources for the member: `member_no` / `member_email` are
 * denormalised onto the row at payment time (and may be null on older rows),
 * while `profiles` is the live join. The member's NAME only exists on the
 * join — this interface used to declare a flat `member_name`, and a `status`
 * field that has not existed since April, which is why the Status column
 * rendered blank on every row.
 */
export interface Contribution {
  id: string
  member_id: string
  /** Denormalised at payment time; prefer `profiles.member_no` when absent. */
  member_no: string | null
  member_email: string | null
  /** Naira, not kobo — normalised in 20260705075811. */
  amount: number
  year: number
  month: string
  transaction_ref: string | null
  payment_method: string | null
  payment_status: ContributionPaymentStatus
  /** Allocation buckets, all Naira. See docs/currency-contract.md. */
  shares: number | null
  social: number | null
  savings: number | null
  deposit: number | null
  notes: string | null
  created_at: string
  updated_at: string
  /** Joined, not flat. Null if the member row was removed. */
  profiles: { full_name: string; member_no: string | null } | null
}

/** The contributor's display name, which lives only on the join. */
export function contributionMemberName(c: Contribution): string {
  return c.profiles?.full_name ?? "—"
}

/** The contributor's number, preferring the live profile over the stored copy. */
export function contributionMemberNo(c: Contribution): string {
  return c.profiles?.member_no ?? c.member_no ?? "—"
}

export interface GetContributionsParams {
  page?: number
  limit?: number
  year?: number
  month?: string
  status?: string
  member_id?: string
}

export interface ContributionListResponse {
  data: Contribution[]
  total: number | null
}

export interface UpdateContributionStatusInput {
  status: "success" | "failed" | "abandoned" | "pending"
}
