import { authedRequest } from "../http"
import type { Member } from "../types/auth"
import type {
  AdminUpdateMemberInput,
  CreateMemberInput,
  PaginatedMembersResponse,
  MemberStatement,
} from "../types/members"

export const membersApi = {
  list: async (params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedMembersResponse> => {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())

    const query = queryParams.toString() ? `?${queryParams.toString()}` : ""

    return authedRequest<PaginatedMembersResponse>(`/v1/members/${query}`)
  },

  create: async (data: CreateMemberInput): Promise<Member> => {
    return authedRequest<Member>("/v1/members/", {
      method: "POST",
      body: data,
    })
  },

  getById: async (id: string): Promise<Member> => {
    return authedRequest<Member>(`/v1/members/${id}`)
  },

  updateById: async (
    id: string,
    data: AdminUpdateMemberInput,
  ): Promise<Member> => {
    return authedRequest<Member>(`/v1/members/${id}`, {
      method: "PATCH",
      body: data,
    })
  },

  /**
   * Every member awaiting approval, oldest first — the whole queue, not a page
   * of it.
   *
   * `list()` is paginated, so counting or filtering pending members from it
   * only ever sees the current 25 rows. This endpoint is unpaginated by
   * design: the queue is meant to be worked through and drained.
   */
  getPendingApplications: async (): Promise<Member[]> => {
    return authedRequest<Member[]>("/v1/members/applications/pending")
  },

  approve: async (id: string): Promise<Member> => {
    return authedRequest<Member>(`/v1/members/${id}/approve`, {
      method: "POST",
    })
  },

  getStatement: async (
    id: string,
    params?: { year?: number },
  ): Promise<MemberStatement> => {
    const queryParams = new URLSearchParams()
    if (params?.year) queryParams.append("year", params.year.toString())

    const query = queryParams.toString() ? `?${queryParams.toString()}` : ""

    return authedRequest<MemberStatement>(
      `/v1/members/${id}/statement${query}`,
    )
  },
}
