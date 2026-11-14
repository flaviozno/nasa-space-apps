// Thin wrapper over the backend HTTP APIs. Paths are relative so the same build works
// behind the Vite dev proxy and behind nginx (see vite.config.ts and nginx.conf).

export const ONBOARD_API = '/api/onboard'
export const EARTH_API = '/api/earth'

export type HealthFetcher = (url: string) => Promise<Response>

export type ServiceHealth =
  | { state: 'ok'; service: string }
  | { state: 'unreachable'; detail: string }

/**
 * Ask one service for `GET /health`; never throws, so the UI can always render a status.
 * Example: `await fetchServiceHealth(ONBOARD_API)` -> `{ state: 'ok', service: 'onboard' }`
 */
export async function fetchServiceHealth(
  baseUrl: string,
  fetcher: HealthFetcher = fetch,
): Promise<ServiceHealth> {
  try {
    const response = await fetcher(`${baseUrl}/health`)
    if (!response.ok) return { state: 'unreachable', detail: `HTTP ${response.status}` }
    const body = (await response.json()) as { service: string }
    return { state: 'ok', service: body.service }
  } catch (error) {
    return { state: 'unreachable', detail: error instanceof Error ? error.message : String(error) }
  }
}
