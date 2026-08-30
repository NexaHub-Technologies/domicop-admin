export type LoanType =
  | "emergency"
  | "personal"
  | "housing"
  | "education"
  | "business"
/**
 * Every value `loans.status` can hold, per the CHECK constraint in
 * 20240601_initial_schema.sql as widened by 20260427000001.
 *
 * `repaid` used to appear here and does not exist server-side; `repaying`,
 * `closed` and `disbursement_failed` were missing, which left a loan being
 * repaid — and, worse, a failed disbursement — rendering as an unstyled label
 * no filter could select.
 */
export type LoanStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "disbursed"
  | "repaying"
  | "closed"
  | "disbursement_failed"
/**
 * What PATCH /loans/:id/process accepts. `approved` is deliberately absent:
 * approval is two officers signing Part C, via POST /loans/:id/sign.
 */
export type ProcessStatus = "rejected" | "under_review"

/**
 * A loan exactly as `GET /v1/loans/` returns it:
 * `select("*, profiles(full_name, member_no)")`.
 *
 * The member's name and number arrive NESTED under `profiles` — they are not
 * flat columns — and the requested figure is `amount_requested`. This
 * interface previously declared `member_name`, `member_no`, `amount`,
 * `amount_paid`, `applied_at`, `processed_at` and `total_repayable`, none of
 * which exist on the table, so the loans table rendered ₦0.00 and blank member
 * names, and the approve modal seeded its amount field with `undefined`.
 * Verify against the table before adding a field here.
 */
export interface Loan {
  id: string
  member_id: string
  amount_requested: number
  amount_approved: number | null
  purpose: string
  type: LoanType
  status: LoanStatus
  interest_rate: number | null
  tenure_months: number | null
  monthly_repayment: number | null
  balance: number | null
  disbursed_at: string | null
  due_date: string | null
  admin_notes: string | null
  paystack_transfer_ref: string | null
  recipient_code: string | null
  created_at: string
  updated_at: string
  /** Joined, not flat. Null if the member row was removed. */
  profiles: { full_name: string; member_no: string | null } | null
}

/** The member's display name for a joined row, with a fallback. */
export function loanMemberName(loan: Loan): string {
  return loan.profiles?.full_name ?? "—"
}

/** The member's number for a joined row; null until they are approved. */
export function loanMemberNo(loan: Loan): string {
  return loan.profiles?.member_no ?? "—"
}

export interface ProcessLoanInput {
  status: ProcessStatus
  amount_approved?: number
  interest_rate?: number
  tenure_months?: number
  admin_notes?: string
}

export interface GetLoansParams {
  page?: number
  limit?: number
  status?: string
}

export interface LoanListResponse {
  data: Loan[]
  total: number | null
}

// POST /loans/:id/disburse returns a transfer-status object, not a Loan row.
// The authoritative outcome arrives later via the Paystack webhook (§6).
export type DisburseStatus = "disbursed" | "pending_otp" | "disbursement_failed"

export interface DisburseResult {
  success: boolean
  status: DisburseStatus
  paystack_transfer_ref?: string
  disbursed_at?: string
  message: string
}

/**
 * Loan term bounds. Mirrors domicoop-server `src/services/loanTerms.ts` and
 * domicoop-mobile `constants/loans.ts` (`loanConfig`) — the cooperative lends
 * over at most one year, with a month of grace after disbursement. Change all
 * three together.
 */
export const MIN_TENURE_MONTHS = 1
export const MAX_TENURE_MONTHS = 12

/** Cooperative office. Both must sign for a loan to be approved (Part C). */
export type OfficerRole = "secretary" | "president"

/** Part B — one of the three guarantors on a loan application. */
export interface LoanGuarantor {
  id: string
  loan_id: string
  position: number
  full_name: string
  bank_name: string
  bank_account: string
  phone: string
  /** SHORT-LIVED signed URL minted per request — the bucket is private. Do not cache. */
  signature_url: string | null
  signed_at: string | null
  created_at: string
}

/** One dated row of the repayment schedule the borrower signed (Part A item 8). */
export interface LoanInstallment {
  id: string
  loan_id: string
  installment_no: number
  due_on: string
  amount: number
  paid_amount: number
  status: "pending" | "paid" | "late"
}

/** An officer's signature on Part C, or on the bond's cancellation clause. */
export interface LoanApproval {
  id: string
  loan_id: string
  officer_id: string
  officer_name: string | null
  officer_role: OfficerRole
  action: "approve" | "cancel_bond"
  amount_approved: number | null
  interest_rate: number | null
  tenure_months: number | null
  signed_at: string
}

/** POST /loans/:id/sign. The first officer sets the terms; the second inherits them. */
export interface SignLoanInput {
  action: "approve" | "cancel_bond"
  amount_approved?: number
  interest_rate?: number
  tenure_months?: number
}

export interface SignLoanResponse {
  loan: Loan
  signatures: OfficerRole[]
  /** The office still to sign, or null once both have. */
  awaiting: OfficerRole | null
  message: string
}

/** GET /loans/:id for admins — the whole application, not just the loan row. */
export interface LoanDetail extends Loan {
  amount_in_words: string | null
  applicant_address: string | null
  applicant_bank_name: string | null
  applicant_bank_account: string | null
  applicant_phone: string | null
  first_installment_on: string | null
  grace_months: number
  approved_at: string | null
  bond_url: string | null
  bond_cancelled_at: string | null
  loan_guarantors: LoanGuarantor[]
  loan_installments: LoanInstallment[]
  loan_approvals: LoanApproval[]
}
