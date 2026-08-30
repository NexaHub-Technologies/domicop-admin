import { request, authedRequest } from "../http"
import type {
  LoginInput,
  ResetPasswordInput,
  ChangePasswordInput,
  AuthResponse,
} from "../types/auth"

export const authApi = {
  login: async (data: LoginInput): Promise<AuthResponse> => {
    return request<AuthResponse>("/v1/auth/login", {
      method: "POST",
      body: data,
    })
  },

  logout: async (): Promise<void> => {
    await authedRequest("/v1/auth/logout", { method: "POST" })
  },

  resetPassword: async (data: ResetPasswordInput): Promise<void> => {
    await request("/v1/auth/reset-password", {
      method: "POST",
      body: data,
    })
  },

  changePassword: async (data: ChangePasswordInput): Promise<void> => {
    await authedRequest("/v1/auth/change-password", {
      method: "POST",
      body: data,
    })
  },
}
