// Typed calls to the onboard Crew API (owner: Matheus). Types come from the generated OpenAPI
// types (src/lib/onboard-types.ts); components use them through the hooks in onboard-queries.ts.

import { ONBOARD_API } from '@/lib/api'
import { requestJson } from '@/lib/http'
import type {
  Alert,
  Baseline,
  CrewMember,
  CrewSummary,
  DailyCheckinInput,
  ManualEntryInput,
  ManualEntryResult,
  MetricTrend,
  MissionReadiness,
  Phq4Input,
  QuestionnaireResult,
  TeamClimateInput,
} from '@/lib/onboard-types'
import type { QuestionnaireStatus } from '@/lib/questionnaire-status'

export { ApiError } from '@/lib/http'

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(`${ONBOARD_API}${path}`, init)
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

  getMissionReadiness: (crewId: string) => request<MissionReadiness>(`${crewPath(crewId)}/mission-readiness`),

  /** PROVISIONAL endpoint (not in the onboard API yet); see src/lib/questionnaire-status.ts. */
  getQuestionnaireStatus: (crewId: string) =>
    request<QuestionnaireStatus>(`${crewPath(crewId)}/questionnaires/status`),

  submitDailyCheckin: (crewId: string, answers: DailyCheckinInput) =>
    post<QuestionnaireResult>(`${crewPath(crewId)}/questionnaires/daily-checkin`, answers),

  submitPhq4: (crewId: string, answers: Phq4Input) =>
    post<QuestionnaireResult>(`${crewPath(crewId)}/questionnaires/phq4`, answers),

  submitTeamClimate: (crewId: string, answer: TeamClimateInput) =>
    post<QuestionnaireResult>(`${crewPath(crewId)}/questionnaires/team-climate`, answer),

  submitManualEntries: (crewId: string, entries: ManualEntryInput) =>
    post<ManualEntryResult>(`${crewPath(crewId)}/manual-entries`, entries),
}
