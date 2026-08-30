import { session } from "./session"
import { endSession } from "./auth-storage"

const BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!BASE_URL) {
  console.error(
    "ERROR: VITE_API_BASE_URL is not defined. Set it in your .env file.",
  )
}

const REQUEST_TIMEOUT_MS = 60000

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

type RequestOptions = {
  method?: RequestMethod
  body?: unknown
  token?: string
  headers?: Record<string, string>
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, token, headers: customHeaders } = options

  if (!BASE_URL) {
    throw new ApiError(
      0,
      "VITE_API_BASE_URL is not configured. Set it in your .env file.",
    )
  }

  const isFormData = body instanceof FormData

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...customHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        0,
        "Request timed out. Check your connection and try again.",
      )
    }
    throw new ApiError(
      0,
      "Network request failed. Check your connection and try again.",
    )
  } finally {
    clearTimeout(timeout)
  }

  const contentType = res.headers.get("content-type")
  let data: T

  if (contentType?.includes("application/json")) {
    data = await res.json()
  } else {
    const text = await res.text()
    if (!res.ok)
      throw new ApiError(
        res.status,
        text.trim() || `Request failed: ${res.status}`,
        text,
      )
    data = text as unknown as T
  }

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.status}`
    // Surface whatever the server actually said. Some endpoints return the
    // `{ error }` / `{ message }` envelope; others return a bare JSON string
    // (e.g. "Invalid login credentials").
    if (typeof data === "string" && data.trim()) {
      errorMessage = data
    } else if (data && typeof data === "object") {
      const errorData = data as { message?: string; error?: string }
      if (errorData.message) errorMessage = errorData.message
      else if (errorData.error) errorMessage = errorData.error
    }
    throw new ApiError(res.status, errorMessage, data)
  }

  return data
}

let refreshPromise: Promise<boolean> | null = null

const refreshSession = async (): Promise<boolean> => {
  const refreshToken = await session.getRefreshToken()
  if (!refreshToken) return false

  try {
    const data = await request<{ access_token: string; refresh_token: string }>(
      "/v1/auth/refresh",
      { method: "POST", body: { refresh_token: refreshToken } },
    )
    await session.setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

export async function authedRequest<T>(
  path: string,
  options: Omit<RequestOptions, "token"> = {},
): Promise<T> {
  const token = await session.getToken()
  if (!token) {
    // No token but possibly still a stored identity — the zombie state. End the
    // session properly so the route guard stops admitting them.
    await endSession()
    throw new ApiError(401, "Not authenticated")
  }

  try {
    const result = await request<T>(path, { ...options, token })
    session.touch().catch(() => {})
    return result
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err

    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null
      })
    }
    const refreshed = await refreshPromise

    if (!refreshed) {
      // The refresh token is spent. Tear down BOTH halves of the session, not
      // just the tokens — see endSession().
      await endSession()
      throw err
    }

    const newToken = await session.getToken()
    const result = await request<T>(path, {
      ...options,
      token: newToken ?? undefined,
    })
    session.touch().catch(() => {})
    return result
  }
}
