import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { EarthAlert, EarthCrewMember, Freshness, SyncStatus } from '@/lib/earth-contract'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000

/** Two crew members whose newest data was taken at `takenAtMs`, with Earth's freshness verdict. */
function crewWithDataFrom(takenAtMs: number, freshness: Freshness = 'FRESH'): EarthCrewMember[] {
  const dataAgeMs = Date.now() - takenAtMs
  return ['Ana Ribeiro', 'Kenji Mori'].map((name, index) => ({
    crewId: `crew-${index + 1}`,
    name,
    role: 'Commander',
    freshness,
    lastMeasuredAtMs: takenAtMs,
    dataAgeMs,
    alertCount: 0,
    metrics: [{ metric: 'heart_rate', value: 80, unit: 'bpm', takenAtMs, dataAgeMs, freshness }],
  }))
}

/** An alert as Earth serves it, created `minutes` ago onboard and received now. */
function alertFrom(minutes: number, fields: Partial<EarthAlert>): EarthAlert {
  const createdAtOnboardMs = minutesAgo(minutes)
  return {
    eventId: 'e1',
    crewId: 'crew-1',
    alertId: 'a1',
    ruleId: 'single_reading_zscore',
    metric: 'spo2',
    value: 89,
    zScore: -8.2,
    message: 'LOW_SPO2 scenario',
    createdAtOnboardMs,
    receivedAtMs: Date.now(),
    dataAgeMs: Date.now() - createdAtOnboardMs,
    deliveryDelayMs: Date.now() - createdAtOnboardMs,
    ...fields,
  }
}

function serveState(sync: Partial<SyncStatus>, lastReceivedAtMs: number, crew: EarthCrewMember[], alerts: EarthAlert[] = []) {
  mockServer.use(
    http.get('*/api/onboard/v1/sync/status', () =>
      HttpResponse.json({
        linkEnabled: true,
        pendingCount: 0,
        pendingAlerts: 0,
        oldestPendingAgeMs: null,
        lastAckAtMs: lastReceivedAtMs,
        lastError: null,
        ...sync,
      }),
    ),
    http.get('*/api/earth/v1/views/status', () =>
      HttpResponse.json({
        generatedAtMs: Date.now(),
        lastReceivedAtMs,
        newestDataAgeMs: Date.now() - lastReceivedAtMs,
        observationEvents: 1200,
        alertEvents: alerts.length,
        conflicts: 0,
        averageDeliveryDelayMs: 4_851,
      }),
    ),
    http.get('*/api/earth/v1/views/crew', () => HttpResponse.json(crew)),
    http.get('*/api/earth/v1/views/alerts', () => HttpResponse.json(alerts)),
  )
}

describe('Earth view', () => {
  it('shows a healthy link, an empty queue and the whole crew', async () => {
    renderAt('/earth')
    const band = await screen.findByRole('region', { name: 'Link status' })
    expect(band).toHaveTextContent('ONLINE')
    expect(band).toHaveTextContent('Queue is empty')
    const crew = await screen.findByRole('region', { name: 'Crew on Earth' })
    expect(within(crew).getAllByRole('article')).toHaveLength(4)
    expect(await within(crew).findByRole('article', { name: 'Lucas Ferreira' })).toHaveTextContent('Alert')
  })

  it('counts every event Earth received and shows the average delivery delay', async () => {
    serveState({}, Date.now(), crewWithDataFrom(Date.now()))
    renderAt('/earth')
    const band = await screen.findByRole('region', { name: 'Link status' })
    expect(await within(band).findByText(/1,200 events received/)).toHaveTextContent('average 5 s delay')
  })

  it('says when Earth has nothing from a crew member yet', async () => {
    const missing = crewWithDataFrom(Date.now()).map((member) => ({
      ...member,
      freshness: 'MISSING' as const,
      lastMeasuredAtMs: null,
      dataAgeMs: null,
      metrics: [],
    }))
    serveState({}, Date.now(), missing)
    renderAt('/earth')
    const card = await screen.findByRole('article', { name: 'Ana Ribeiro' })
    expect(card).toHaveTextContent('No data yet')
    expect(card).not.toHaveTextContent('Nominal')
  })

  it('falls behind while the link is down: OFFLINE, growing queue and STALE data', async () => {
    serveState(
      { linkEnabled: false, pendingCount: 342, pendingAlerts: 1, oldestPendingAgeMs: 6 * 60_000, lastError: 'Earth link disabled' },
      minutesAgo(12),
      crewWithDataFrom(minutesAgo(12), 'STALE'),
    )
    renderAt('/earth')
    const band = await screen.findByRole('region', { name: 'Link status' })
    expect(band).toHaveTextContent('OFFLINE')
    expect(within(band).getByLabelText('Pending events')).toHaveTextContent('342')
    expect(band).toHaveTextContent('1 alert waiting')
    expect(band).toHaveTextContent('Earth data is behind')
    expect(await screen.findAllByText('STALE')).toHaveLength(2)
  })

  it('shows how late an alert reached Earth', async () => {
    serveState({}, Date.now(), crewWithDataFrom(Date.now()), [alertFrom(9, {})])
    renderAt('/earth')
    const alerts = await screen.findByRole('region', { name: 'Alerts received on Earth' })
    expect(await within(alerts).findByText(/Ana Ribeiro/)).toBeInTheDocument()
    expect(alerts).toHaveTextContent('9 min delay')
  })

  it('shows a synced readiness recommendation with its bounded evidence', async () => {
    serveState({}, Date.now(), crewWithDataFrom(Date.now()), [
      alertFrom(3, {
        eventId: 'readiness-1',
        metric: 'heart_rate',
        value: 126,
        zScore: 5,
        message: 'Review before a critical task.',
        recommendationStatus: 'REVIEW_BEFORE_CRITICAL_TASK',
        evidence: [
          { id: 'hr', label: 'Heart rate', value: 126, unit: 'bpm', takenAt: Date.now(), source: 'wearable', sourceRef: 'sample' },
          { id: 'fatigue', label: 'Fatigue check-in', value: 8, unit: 'score', takenAt: Date.now(), source: 'questionnaire', sourceRef: 'checkin' },
          { id: 'rad', label: 'Historical reference', value: 10.2, unit: 'microGy/h', takenAt: Date.now(), source: 'nasa_osdr_radlab', sourceRef: 'dostel' },
        ],
        disclaimer: 'Historical reference only.',
      }),
    ])
    renderAt('/earth')
    const alerts = await screen.findByRole('region', { name: 'Alerts received on Earth' })
    expect(await within(alerts).findByText('REVIEW BEFORE CRITICAL TASK')).toBeInTheDocument()
    expect(alerts).toHaveTextContent('Fatigue check-in 8 score')
    expect(alerts).toHaveTextContent('Historical reference only.')
  })

  it('cuts and restores the link from the demo control', async () => {
    renderAt('/earth')
    fireEvent.click(await screen.findByRole('button', { name: /Cut the link/ }))
    const band = screen.getByRole('region', { name: 'Link status' })
    expect(await within(band).findByText('OFFLINE')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Restore the link/ }))
    expect(await within(band).findByText('ONLINE')).toBeInTheDocument()
  })

  it('explains when the link cannot be changed (e.g. missing admin token)', async () => {
    mockServer.use(
      http.put('*/api/onboard/v1/sync/link', () => HttpResponse.json({ detail: 'missing or invalid bearer token' }, { status: 401 })),
    )
    renderAt('/earth')
    fireEvent.click(await screen.findByRole('button', { name: /Cut the link/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the link: missing or invalid bearer token')
  })
})
