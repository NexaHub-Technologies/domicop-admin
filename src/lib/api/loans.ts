import { authedRequest } from "../http"
import type {
  Loan,
  LoanDetail,
  SignLoanInput,
  SignLoanResponse,
  ProcessLoanInput,
  GetLoansParams,
  LoanListResponse,
  DisburseResult,
} from "../types/loans"

export const loansApi = {
  list: async (params?: GetLoansParams): Promise<LoanListResponse> => {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)

    const query = queryParams.toString() ? `?${queryParams.toString()}` : ""

    return authedRequest<LoanListResponse>(`/v1/loans/${query}`)
  },

  getDetail: async (id: string): Promise<LoanDetail> => {
    return authedRequest<LoanDetail>(`/v1/loans/${id}`)
  },

  /**
   * Sign for the cooperative. Requires the caller to hold an office.
   *
   * Approval needs BOTH the secretary and the president; the response's
   * `awaiting` says which office is still outstanding, and is null once the
   * loan has been approved.
   */
  sign: async (id: string, data: SignLoanInput): Promise<SignLoanResponse> => {
    return authedRequest<SignLoanResponse>(`/v1/loans/${id}/sign`, {
      method: "POST",
      body: data,
    })
  },

  process: async (
    id: string,
    data: ProcessLoanInput,
  ): Promise<Loan> => {
    return authedRequest<Loan>(`/v1/loans/${id}/process`, {
      method: "PATCH",
      body: data,
    })
  },

  disburse: async (id: string): Promise<DisburseResult> => {
    return authedRequest<DisburseResult>(`/v1/loans/${id}/disburse`, {
      method: "POST",
    })
  },
}
