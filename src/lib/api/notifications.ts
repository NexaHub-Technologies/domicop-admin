import { authedRequest } from "../http"
import type {
  NotificationsListResponse,
  GetNotificationsParams,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  BroadcastNotificationInput,
  BroadcastResponse,
} from "../types/notifications"

export const notificationsApi = {
  getMyNotifications: async (
    params?: GetNotificationsParams,
  ): Promise<NotificationsListResponse> => {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())

    const query = queryParams.toString() ? `?${queryParams.toString()}` : ""

    return authedRequest<NotificationsListResponse>(
      `/v1/notifications/me${query}`,
    )
  },

  markAllRead: async (): Promise<void> => {
    await authedRequest("/v1/notifications/me/read-all", { method: "POST" })
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    return authedRequest<NotificationPreferences>(
      "/v1/notifications/preferences",
    )
  },

  updatePreferences: async (
    data: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> => {
    return authedRequest<NotificationPreferences>(
      "/v1/notifications/preferences",
      {
        method: "PATCH",
        body: data,
      },
    )
  },

  broadcast: async (
    data: BroadcastNotificationInput,
  ): Promise<BroadcastResponse> => {
    return authedRequest<BroadcastResponse>("/v1/notifications/broadcast", {
      method: "POST",
      body: data,
    })
  },
}
