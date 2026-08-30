import { authedRequest } from "../http"
import type {
  Contribution,
  GetContributionsParams,
  ContributionListResponse,
  UpdateContributionStatusInput,
} from "../types/contributions"

export const contributionsApi = {
  list: async (
    params?: GetContributionsParams,
  ): Promise<ContributionListResponse> => {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    if (params?.member_id) queryParams.append("member_id", params.member_id)
    if (params?.year) queryParams.append("year", params.year.toString())

    const query = queryParams.toString() ? `?${queryParams.toString()}` : ""

    return authedRequest<ContributionListResponse>(
      `/v1/contributions/${query}`,
    )
  },

  updateStatus: async (
    id: string,
    data: UpdateContributionStatusInput,
  ): Promise<Contribution> => {
    return authedRequest<Contribution>(`/v1/contributions/${id}/status`, {
      method: "PATCH",
      body: data,
    })
  },
}
