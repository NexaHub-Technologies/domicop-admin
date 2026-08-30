import { authedRequest } from "../http"
import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "../types/announcements"

export const announcementsApi = {
  getAll: async (): Promise<Announcement[]> => {
    return authedRequest<Announcement[]>("/v1/announcements/all")
  },

  create: async (data: CreateAnnouncementInput): Promise<Announcement> => {
    return authedRequest<Announcement>("/v1/announcements/", {
      method: "POST",
      body: data,
    })
  },

  update: async (
    id: string,
    data: UpdateAnnouncementInput,
  ): Promise<Announcement> => {
    return authedRequest<Announcement>(`/v1/announcements/${id}`, {
      method: "PATCH",
      body: data,
    })
  },

  delete: async (id: string): Promise<void> => {
    await authedRequest(`/v1/announcements/${id}`, { method: "DELETE" })
  },
}
