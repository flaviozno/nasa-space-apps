import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/onboard-api'

/**
 * One shared client for the app. A 4xx means the request itself is wrong (unknown crew
 * member, invalid answer), so retrying cannot help; network errors and 5xx retry twice.
 * Tests pass `{ retry: false }` to fail fast.
 */
export function createQueryClient({ retry = true }: { retry?: boolean } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retry
          ? (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2
          : false,
      },
      mutations: { retry: false },
    },
  })
}
