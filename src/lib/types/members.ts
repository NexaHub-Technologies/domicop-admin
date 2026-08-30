import type { Member } from "./auth"

// Per the API contract (§4), PATCH /members/:id intentionally does NOT accept
// `role`. Granting admin is done via POST /admins, never by editing a member.
export interface AdminUpdateMemberInput {
  status?: "pending" | "active" | "suspended"
  member_no?: string
}

export interface CreateMemberInput {
  email: string
  password: string
  full_name: string
  phone: string
  address: string
  next_of_kin?: string
}

export interface PaginatedMembersResponse {
  data: Member[]
  total: number | null
  page: number
  limit: number
}

export interface MemberStatement {
  member: Member
  transactions: StatementEntry[]
  summary: {
    total_contributions: number
    total_loans: number
    total_dividends: number
    balance: number
  }
}

export interface StatementEntry {
  id: string
  type: "contribution" | "loan" | "dividend" | "repayment"
  description: string
  amount: number
  reference: string
  date: string
  status: string
}
