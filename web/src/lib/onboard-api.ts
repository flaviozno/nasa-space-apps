// Typed calls to the onboard Crew API (owner: Matheus). Types come from the generated OpenAPI
// types (src/lib/onboard-types.ts); components use them through the hooks in onboard-queries.ts.

import { ONBOARD_API } from '@/lib/api'
import type {
  Alert,
  Baseline,
  CrewMember,
  CrewSummary,
  DailyCheckinInput,
  ManualEntryInput,
  ManualEntryResult,
  MetricTrend,
  Phq4Input,
  QuestionnaireResult,
  TeamClimateInput,
} from '@/lib/onboard-types'

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ONBOARD_API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, describeError(response.status, body))
  }
  return (await response.json()) as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

const crewPath = (crewId: string) => `/v1/crew/${encodeURIComponent(crewId)}`

export interface TrendOptions {
  windowMinutes?: number
  maxPoints?: number
}

export const onboardApi = {
  listCrew: () => request<CrewMember[]>('/v1/crew'),

  getBaseline: (crewId: string) => request<Baseline>(`${crewPath(crewId)}/baseline`),

  getMetrics: (crewId: string) => request<CrewSummary>(`${crewPath(crewId)}/metrics`),

  getTrend: (crewId: string, metric: string, { windowMinutes = 30, maxPoints = 60 }: TrendOptions = {}) => {
    const query = new URLSearchParams({ windowMinutes: String(windowMinutes), maxPoints: String(maxPoints) })
    return request<MetricTrend>(`${crewPath(crewId)}/metrics/${encodeURIComponent(metric)}/trends?${query}`)
  },

  getAlerts: (crewId: string) => request<Alert[]>(`${crewPath(crewId)}/alerts`),

  submitDailyCheckin: (crewId: string, answers: DailyCheckinInput) =>
    post<QuestionnaireResult>(`${crewPath(crewId)}/questionnaires/daily-checkin`, answers),

  submitPhq4: (crewId: string, answers: Phq4Input) =>
    post<QuestionnaireResult>(`${crewPath(crewId)}/questionnaires/phq4`, answers),

  submitTeamClimate: (crewId: string, answer: TeamClimateInput) =>
    post<QuestionnaireResult>(`${crewPath(crewId)}/questionnaires/team-climate`, answer),

  submitManualEntries: (crewId: string, entries: ManualEntryInput) =>
    post<ManualEntryResult>(`${crewPath(crewId)}/manual-entries`, entries),
}
