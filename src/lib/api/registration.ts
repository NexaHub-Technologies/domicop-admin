import { authedRequest } from "../http"
import type {
  RegistrationWindow,
  CreateRegistrationWindowInput,
  UpdateRegistrationWindowInput,
  RegistrationApplicant,
} from "../types/registration"

export const registrationApi = {
  listWindows: async (): Promise<RegistrationWindow[]> => {
    return authedRequest<RegistrationWindow[]>("/v1/registration/windows")
  },

  createWindow: async (
    data: CreateRegistrationWindowInput
  ): Promise<RegistrationWindow> => {
    return authedRequest<RegistrationWindow>("/v1/registration/windows", {
      method: "POST",
      body: data,
    })
  },

  updateWindow: async (
    id: string,
    data: UpdateRegistrationWindowInput
  ): Promise<RegistrationWindow> => {
    return authedRequest<RegistrationWindow>(`/v1/registration/windows/${id}`, {
      method: "PATCH",
      body: data,
    })
  },

  // Opening only lifts the manual override; the window still respects its own
  // dates and capacity.
  openWindow: async (id: string): Promise<RegistrationWindow> => {
    return authedRequest<RegistrationWindow>(
      `/v1/registration/windows/${id}/open`,
      { method: "POST" }
    )
  },

  // Terminal — a closed intake cannot be reopened, so each one keeps its own
  // fees and applicants.
  closeWindow: async (id: string): Promise<RegistrationWindow> => {
    return authedRequest<RegistrationWindow>(
      `/v1/registration/windows/${id}/close`,
      { method: "POST" }
    )
  },

  listApplications: async (id: string): Promise<RegistrationApplicant[]> => {
    return authedRequest<RegistrationApplicant[]>(
      `/v1/registration/windows/${id}/applications`
    )
  },
}
