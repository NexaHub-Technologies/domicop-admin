import { authedRequest } from "../http"
import type {
  AdminProfile,
  CreateAdminInput,
  CreateAdminResponse,
} from "../types/admins"

export const adminsApi = {
  // GET /admins → array of admins
  list: async (): Promise<AdminProfile[]> => {
    return authedRequest<AdminProfile[]>("/v1/admins")
  },

  // POST /admins → 201 { id, email, full_name }
  create: async (data: CreateAdminInput): Promise<CreateAdminResponse> => {
    return authedRequest<CreateAdminResponse>("/v1/admins", {
      method: "POST",
      body: data,
    })
  },

  // DELETE /admins/:id → 204. Cannot revoke yourself → 400.
  /**
   * Assign or clear a cooperative office. Pass null to clear.
   *
   * At most one holder per office, so reassigning means clearing the incumbent
   * first — the server answers 409 otherwise.
   */
  setOffice: async (
    id: string,
    officer_role: "secretary" | "president" | null,
  ): Promise<AdminProfile> => {
    return authedRequest<AdminProfile>(`/v1/admins/${id}/office`, {
      method: "PATCH",
      body: { officer_role },
    })
  },

  revoke: async (id: string): Promise<void> => {
    await authedRequest(`/v1/admins/${id}`, { method: "DELETE" })
  },
}
