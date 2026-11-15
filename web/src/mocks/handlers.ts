// MSW handlers for the onboard Crew API, used by `npm run dev:mock` and by tests.
//
// fixtures/onboard.json holds real responses captured from Matheus's Phase 0 stubs
// (onboard/app/crew), so the shapes match the OpenAPI. Timestamps are shifted to "now" on
// every request, so the data never looks stale.

import { http, HttpResponse } from 'msw'
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
  Observation,
  ObservationBatchInput,
  ObservationBatchResult,
  Phq4Input,
  QuestionnaireResult,
  TeamClimateInput,
} from '@/lib/onboard-types'
import { isAvailable, type QuestionnaireStatus, windowAfter } from '@/lib/questionnaire-status'
import onboardFixtures from './fixtures/onboard.json'

interface MemberFixtures {
  baseline: Baseline
  metrics: CrewSummary
  alerts: Alert[]
  trends: Record<string, MetricTrend>
}

interface OnboardFixtures {
  capturedAt: number
  crew: CrewMember[]
  members: Record<string, MemberFixtures>
  observations: Observation[]
}

const fixtures = onboardFixtures as unknown as OnboardFixtures

const TIMESTAMP_KEYS = new Set(['takenAt', 'generatedAt', 'createdAt', 'submittedAt'])

/** Deep copy of a fixture with every timestamp moved forward by the time since capture. */
function fresh<T>(value: T): T {
  const delta = Date.now() - fixtures.capturedAt
  return JSON.parse(JSON.stringify(value), (key, v) =>
    TIMESTAMP_KEYS.has(key) && typeof v === 'number' ? v + delta : v,
  ) as T
}

/** Same 404 body as the API: `{"detail": "unknown crewId: crew-9"}`. */
function notFound(detail: string) {
  return HttpResponse.json({ detail }, { status: 404 })
}

function unitOf(member: MemberFixtures, metric: string): string | undefined {
  return member.baseline.baselines.find((b) => b.metric === metric)?.unit
}

function questionnaireResult(
  crewId: string,
  questionnaire: string,
  total: number | null,
  observationsCreated: number,
): QuestionnaireResult {
  return {
    responseId: crypto.randomUUID(),
    crewId,
    questionnaire,
    submittedAt: Date.now(),
    total,
    observationsCreated,
  }
}

// Questionnaire submissions made during this session, so the mock can enforce the same
// once-per-window rule the backend will (daily: until 00:00 UTC; weekly: 7 days).
type QuestionnaireKind = keyof QuestionnaireStatus
const submissions = new Map<string, number>()
const submissionKey = (crewId: string, kind: QuestionnaireKind) => `${crewId}:${kind}`

/** Forget every questionnaire submission (tests call this between cases). */
export function resetMockSubmissions() {
  submissions.clear()
}

function statusFor(crewId: string): QuestionnaireStatus {
  const window = (kind: QuestionnaireKind) => windowAfter(kind, submissions.get(submissionKey(crewId, kind)) ?? null)
  return { dailyCheckin: window('dailyCheckin'), phq4: window('phq4'), teamClimate: window('teamClimate') }
}

/** Records a submission, or returns the 409 the backend is expected to send when it is too early. */
function recordSubmission(crewId: string, kind: QuestionnaireKind) {
  const window = statusFor(crewId)[kind]
  if (!isAvailable(window, Date.now())) {
    return HttpResponse.json({ detail: `${kind} already submitted; available again at ${new Date(window.availableAgainAt!).toISOString()}` }, { status: 409 })
  }
  submissions.set(submissionKey(crewId, kind), Date.now())
  return null
}

const crew = `${ONBOARD_API}/v1/crew`

export const handlers = [
  http.get(crew, () => HttpResponse.json(fixtures.crew)),

  http.get(`${crew}/:crewId/baseline`, ({ params }) => {
    const member = fixtures.members[String(params.crewId)]
    return member ? HttpResponse.json(member.baseline) : notFound(`unknown crewId: ${params.crewId}`)
  }),

  http.get(`${crew}/:crewId/metrics`, ({ params }) => {
    const member = fixtures.members[String(params.crewId)]
    return member ? HttpResponse.json(fresh(member.metrics)) : notFound(`unknown crewId: ${params.crewId}`)
  }),

  http.get(`${crew}/:crewId/metrics/:metricId/trends`, ({ params }) => {
    const member = fixtures.members[String(params.crewId)]
    if (!member) return notFound(`unknown crewId: ${params.crewId}`)
    const trend = member.trends[String(params.metricId)]
    return trend ? HttpResponse.json(fresh(trend)) : notFound(`unknown metric: ${params.metricId}`)
  }),

  http.get(`${crew}/:crewId/alerts`, ({ params }) => {
    const member = fixtures.members[String(params.crewId)]
    return member ? HttpResponse.json(fresh(member.alerts)) : notFound(`unknown crewId: ${params.crewId}`)
  }),

  http.get(`${crew}/:crewId/mission-readiness`, ({ params }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const review = crewId === 'crew-3'
    const now = Date.now()
    return HttpResponse.json({
      crewId,
      status: review ? 'REVIEW_BEFORE_CRITICAL_TASK' : 'MONITOR',
      ruleId: 'mission_readiness_context',
      ruleVersion: '1',
      evaluatedAt: now,
      sufficientContext: review,
      message: review
        ? 'Review before a critical task: heart rate differs from personal baseline, fatigue is elevated, and a historical environmental radiation reference is elevated.'
        : 'Mission context is incomplete; monitor before a critical task.',
      evidence: review ? [
        { id: 'hr-demo', label: 'Heart rate', value: 125, unit: 'bpm', takenAt: now - 30_000, source: 'wearable', sourceRef: 'demo-hr' },
        { id: 'fatigue-demo', label: 'Fatigue check-in', value: 8, unit: 'score', takenAt: now - 60_000, source: 'questionnaire', sourceRef: 'demo-checkin' },
        { id: 'dostel-demo', label: 'Historical ISS DosTel dose-rate reference', value: 10.2, unit: 'microGy/h', takenAt: now - 90_000, source: 'nasa_osdr_radlab', sourceRef: 'dostel-demo', detail: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/' },
      ] : [],
      disclaimer: 'Historical NASA environmental reference; not a personal radiation dose or medical diagnosis.',
    })
  }),

  http.post(`${crew}/:crewId/manual-entries`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    const member = fixtures.members[crewId]
    if (!member) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as ManualEntryInput
    const now = Date.now()
    const result: ManualEntryResult = {
      accepted: body.entries.map((entry) => {
        const takenAt = entry.takenAt ?? now
        return {
          id: crypto.randomUUID(),
          crewId,
          metric: entry.metric,
          value: entry.value,
          unit: unitOf(member, entry.metric) ?? '',
          source: 'manual',
          sourceRef: `manual-${crewId}-${entry.metric}-${takenAt}`,
          takenAt,
        }
      }),
      duplicates: 0,
    }
    return HttpResponse.json(result, { status: 201 })
  }),

  http.get(`${crew}/:crewId/questionnaires/status`, ({ params }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    return HttpResponse.json(statusFor(crewId))
  }),

  http.post(`${crew}/:crewId/questionnaires/daily-checkin`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as DailyCheckinInput
    const tooEarly = recordSubmission(crewId, 'dailyCheckin')
    if (tooEarly) return tooEarly
    return HttpResponse.json(questionnaireResult(crewId, 'daily_checkin', null, Object.keys(body).length), {
      status: 201,
    })
  }),

  http.post(`${crew}/:crewId/questionnaires/phq4`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as Phq4Input
    const tooEarly = recordSubmission(crewId, 'phq4')
    if (tooEarly) return tooEarly
    const total = body.answers.reduce((sum, answer) => sum + answer, 0)
    return HttpResponse.json(questionnaireResult(crewId, 'phq4', total, 1), { status: 201 })
  }),

  http.post(`${crew}/:crewId/questionnaires/team-climate`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as TeamClimateInput
    const tooEarly = recordSubmission(crewId, 'teamClimate')
    if (tooEarly) return tooEarly
    return HttpResponse.json(questionnaireResult(crewId, 'team_climate', body.score, 1), { status: 201 })
  }),

  http.get(`${ONBOARD_API}/v1/observations`, ({ request }) => {
    const url = new URL(request.url)
    const crewId = url.searchParams.get('crewId') ?? 'crew-1'
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const limit = Number(url.searchParams.get('limit') ?? 100)
    const rows = fixtures.observations.slice(0, limit).map((o) => ({ ...o, crewId }))
    return HttpResponse.json(fresh(rows))
  }),

  http.post(`${ONBOARD_API}/v1/observations`, async ({ request }) => {
    const body = (await request.json()) as ObservationBatchInput
    const now = Date.now()
    const result: ObservationBatchResult = {
      accepted: body.observations.map((o) => {
        const member = fixtures.members[o.crewId]
        return {
          id: crypto.randomUUID(),
          crewId: o.crewId,
          metric: o.metric,
          value: o.value ?? null,
          unit: (member && unitOf(member, o.metric)) ?? '',
          source: o.source,
          sourceRef: o.sourceRef ?? null,
          takenAt: o.takenAt ?? now,
        }
      }),
      duplicates: 0,
    }
    return HttpResponse.json(result, { status: 201 })
  }),
]
