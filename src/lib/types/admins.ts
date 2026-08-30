// Admin accounts live in the `admin_profiles` table (§3). They have no member
// profile; admin status is resolved server-side from the bearer token.
export interface AdminProfile {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_super_admin: boolean
  /**
   * Cooperative office held, if any. Distinct from is_super_admin: only the
   * secretary and the president may sign a loan (Part C), and most admins
   * hold neither office.
   */
  officer_role: "secretary" | "president" | null
  created_at: string
}

export interface CreateAdminInput {
  email: string
  password: string // >= 8 chars
  full_name: string // >= 2 chars
  phone?: string
}

// POST /admins → 201
export interface CreateAdminResponse {
  id: string
  email: string
  full_name: string
}
