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

  http.post(`${crew}/:crewId/questionnaires/daily-checkin`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as DailyCheckinInput
    return HttpResponse.json(questionnaireResult(crewId, 'daily_checkin', null, Object.keys(body).length), {
      status: 201,
    })
  }),

  http.post(`${crew}/:crewId/questionnaires/phq4`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as Phq4Input
    const total = body.answers.reduce((sum, answer) => sum + answer, 0)
    return HttpResponse.json(questionnaireResult(crewId, 'phq4', total, 1), { status: 201 })
  }),

  http.post(`${crew}/:crewId/questionnaires/team-climate`, async ({ params, request }) => {
    const crewId = String(params.crewId)
    if (!fixtures.members[crewId]) return notFound(`unknown crewId: ${crewId}`)
    const body = (await request.json()) as TeamClimateInput
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
