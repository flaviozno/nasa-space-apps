// Shared JSON-over-HTTP helper for the onboard and Earth APIs (both FastAPI).

/** HTTP error from the API, with FastAPI's `detail` turned into readable text. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ValidationIssue {
  loc?: (string | number)[]
  msg?: string
}

/**
 * FastAPI sends `{"detail": "unknown crewId: crew-9"}` for 404 and
 * `{"detail": [{"loc": ["body", "mood"], "msg": "..."}]}` for 422.
 * Example: 422 on mood → "mood: Input should be less than or equal to 10".
 */
function describeError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return (detail as ValidationIssue[])
      .map((issue) => {
        const field = issue.loc?.filter((part) => part !== 'body').join('.')
        return field ? `${field}: ${issue.msg ?? 'invalid'}` : (issue.msg ?? 'invalid')
      })
      .join('; ')
  }
  return `HTTP ${status}`
}

/** Fetch JSON from `url`; non-2xx responses throw ApiError with FastAPI's `detail` as message. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, describeError(response.status, body))
  }
  return (await response.json()) as T
}
