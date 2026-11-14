import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ApiError, onboardApi } from '@/lib/onboard-api'
import { mockServer, startMockServer } from '@/test/mock-server'

startMockServer()

describe('onboardApi', () => {
  it('lists the crew', async () => {
    const crew = await onboardApi.listCrew()
    expect(crew).toHaveLength(4)
  })

  it('sends trend options as query parameters', async () => {
    let requested: URL | undefined
    mockServer.use(
      http.get('*/api/onboard/v1/crew/:crewId/metrics/:metricId/trends', ({ request }) => {
        requested = new URL(request.url)
        return HttpResponse.json({ crewId: 'crew-1', metric: 'heart_rate', unit: 'bpm', points: [] })
      }),
    )
    await onboardApi.getTrend('crew-1', 'heart_rate', { windowMinutes: 120, maxPoints: 40 })
    expect(requested?.searchParams.get('windowMinutes')).toBe('120')
    expect(requested?.searchParams.get('maxPoints')).toBe('40')
  })

  it('throws ApiError with the API detail on 404', async () => {
    const error = await onboardApi.getMetrics('crew-9').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'unknown crewId: crew-9' })
  })

  it('turns a 422 validation list into readable text', async () => {
    mockServer.use(
      http.post('*/api/onboard/v1/crew/:crewId/questionnaires/team-climate', () =>
        HttpResponse.json(
          { detail: [{ loc: ['body', 'score'], msg: 'Input should be less than or equal to 10' }] },
          { status: 422 },
        ),
      ),
    )
    await expect(onboardApi.submitTeamClimate('crew-1', { score: 11 })).rejects.toMatchObject({
      status: 422,
      message: 'score: Input should be less than or equal to 10',
    })
  })

  it('submits the daily check-in', async () => {
    const result = await onboardApi.submitDailyCheckin('crew-1', {
      mood: 7,
      stress: 4,
      fatigue: 3,
      sleepiness: 3,
      symptomHeadache: 0,
      symptomBackPain: 0,
      symptomCongestion: 0,
      symptomEyeIrritation: 0,
      symptomSkin: 0,
      symptomNausea: 0,
    })
    expect(result).toMatchObject({ crewId: 'crew-1', questionnaire: 'daily_checkin', observationsCreated: 10 })
  })
})
