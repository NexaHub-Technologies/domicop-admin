export interface LoginInput {
  email: string
  password: string
}

export interface ResetPasswordInput {
  email: string
}

// ResendVerificationInput was removed alongside authApi.resendVerification:
// it targeted POST /v1/auth/resend-verification, which the server has never
// implemented. Re-add both together if that endpoint is ever built.

export interface ChangePasswordInput {
  current_password: string
  new_password: string
}

// The login/session user (§2) — admins have no member profile, so this is a
// minimal identity, not the full `Member` row.
export interface AuthUser {
  id: string
  email: string
  role: "member" | "admin"
  email_verified?: boolean
  full_name?: string
  avatar_url?: string
}

// Per the API contract (§2), auth endpoints return a FLAT payload —
// tokens live alongside `user`, not nested under a `tokens` key.
export interface AuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: AuthUser
}

export interface Member {
  id: string
  member_no: string
  email: string
  full_name: string
  phone: string
  address: string
  role: "member" | "admin"
  status: "pending" | "active" | "suspended"
  avatar_url?: string
  bank_name?: string
  bank_account?: string
  bank_code?: string
  next_of_kin?: string
  created_at: string
  updated_at: string

  // Fields from the MEM membership registration form. Optional throughout:
  // every member who joined before the registration portal has none of them.
  sex?: string | null
  date_of_birth?: string | null
  whatsapp_number?: string | null
  marital_status?: string | null
  id_card_number?: string | null
  place_of_work?: string | null
  type_of_business?: string | null
  referred_by?: string | null
  monthly_subscription?: number | null
  /** SHORT-LIVED signed URL minted per request — the bucket is private. Do not cache. */
  signature_url?: string | null
  registration_window_id?: string | null
  registration_fee_paid?: boolean
  registration_paid_at?: string | null
  registration_ref?: string | null
}
