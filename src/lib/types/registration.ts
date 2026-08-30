/** Manual override on an intake. Openness also depends on the clock and capacity — see `is_open`. */
export type RegistrationWindowState = "draft" | "open" | "closed"

/** A full intake row, as returned to admins. Amounts are whole Naira. */
export interface RegistrationWindow {
  id: string
  name: string
  opens_at: string
  closes_at: string
  state: RegistrationWindowState
  capacity: number | null
  applications_count: number
  registration_fee: number
  social_fee: number
  min_monthly_subscription: number
  max_monthly_subscription: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateRegistrationWindowInput {
  name: string
  opens_at: string
  closes_at: string
  capacity?: number | null
  registration_fee?: number
  social_fee?: number
  min_monthly_subscription?: number
  max_monthly_subscription?: number
}

export type UpdateRegistrationWindowInput =
  Partial<CreateRegistrationWindowInput>

/**
 * One applicant of an intake.
 *
 * `signature_url` is a SHORT-LIVED signed URL minted per request — the bucket
 * is private. Do not cache or persist it; re-fetch the list instead.
 */
export interface RegistrationApplicant {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  whatsapp_number: string | null
  sex: string | null
  date_of_birth: string | null
  marital_status: string | null
  address: string | null
  id_card_number: string | null
  next_of_kin: string | null
  place_of_work: string | null
  type_of_business: string | null
  referred_by: string | null
  bank_name: string | null
  bank_account: string | null
  monthly_subscription: number | null
  signature_url: string | null
  member_no: string | null
  status: "pending" | "active" | "suspended"
  registration_fee_paid: boolean
  registration_paid_at: string | null
  registration_ref: string | null
  created_at: string
}
