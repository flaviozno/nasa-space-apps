import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ONBOARD_API } from '@/lib/api'
import type { CrewMember, CrewSummary, ManualEntryResult, QuestionnaireResult } from '@/lib/onboard-types'
import { handlers } from './handlers'

const server = setupServer(...handlers)
const api = (path: string) => `${location.origin}${ONBOARD_API}${path}`

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('onboard mock handlers', () => {
  it('lists the 4 crew members from contracts/crew.json', async () => {
    const crew = (await (await fetch(api('/v1/crew'))).json()) as CrewMember[]
    expect(crew.map((c) => c.crewId)).toEqual(['crew-1', 'crew-2', 'crew-3', 'crew-4'])
    expect(crew[0].name).toBe('Ana Ribeiro')
  })

  it('serves metric summaries with timestamps shifted to now', async () => {
    const before = Date.now()
    const summary = (await (await fetch(api('/v1/crew/crew-1/metrics'))).json()) as CrewSummary
    expect(summary.generatedAt).toBeGreaterThanOrEqual(before - 60_000)
    expect(summary.metrics.find((m) => m.metric === 'heart_rate')?.status).toBe('OK')
  })

  it('answers 404 like the API for an unknown crew member', async () => {
    const response = await fetch(api('/v1/crew/crew-9/metrics'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'unknown crewId: crew-9' })
  })

  it('echoes manual entries as observations with the catalog unit', async () => {
    const response = await fetch(api('/v1/crew/crew-2/manual-entries'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [{ metric: 'body_mass', value: 74.2 }] }),
    })
    const result = (await response.json()) as ManualEntryResult
    expect(response.status).toBe(201)
    expect(result.accepted[0]).toMatchObject({ crewId: 'crew-2', metric: 'body_mass', unit: 'kg', source: 'manual' })
  })

  it('scores the PHQ-4 total', async () => {
    const response = await fetch(api('/v1/crew/crew-1/questionnaires/phq4'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [1, 2, 0, 0] }),
    })
    expect(((await response.json()) as QuestionnaireResult).total).toBe(3)
  })
})
