// MSW handlers for the Earth view: the onboard sync status/link (shape from Guilherme's
// feat/outbox-sync branch) and the PROVISIONAL Earth /v1/views/* endpoints.
//
// A small time-based simulation stands in for the outbox, so the demo's scene 4 can be
// rehearsed without the backend:
// - link up: readings reach Earth right away;
// - link down: the outbox grows by PRODUCED_PER_SECOND and Earth's data freezes;
//   shortly after the cut an onboard LOW SpO₂ alert is raised (mock-only, for the story);
// - link back: the backlog drains DRAIN_PER_SECOND faster, then Earth is up to date again.

import { http, HttpResponse } from 'msw'
import { EARTH_API, ONBOARD_API } from '@/lib/api'
import type { EarthAlert, EarthCrewMember, SyncStatus } from '@/lib/earth-contract'
import type { CrewMember, CrewSummary } from '@/lib/onboard-types'
import onboardFixtures from './fixtures/onboard.json'

const PRODUCED_PER_SECOND = 4 // 4 crew × 1 reading/s ≈ 240 events/min
const DRAIN_PER_SECOND = 40
const ALERT_AFTER_CUT_MS = 8_000
const EARTH_METRICS = ['heart_rate', 'spo2', 'body_temp'] as const

const fixtures = onboardFixtures as unknown as {
  crew: CrewMember[]
  members: Record<string, { metrics: CrewSummary; alerts: { alertId: string; metric?: string | null; value?: number | null; zScore?: number | null; message: string }[] }>
}

interface MockAlert extends Omit<EarthAlert, 'receivedAtMs'> {
  receivedAtMs: number | null
}

interface Simulation {
  linkEnabled: boolean
  pending: number
  /** Onboard time of the oldest event still in the outbox. */
  pendingSinceMs: number | null
  lastTickMs: number
  lastAckAtMs: number
  eventsReceived: number
  linkCutAtMs: number | null
  alerts: MockAlert[]
}

function initialSimulation(now = Date.now()): Simulation {
  const crew3Alert = fixtures.members['crew-3']?.alerts[0]
  return {
    linkEnabled: true,
    pending: 0,
    pendingSinceMs: null,
    lastTickMs: now,
    lastAckAtMs: now,
    eventsReceived: 12_480,
    linkCutAtMs: null,
    alerts: crew3Alert
      ? [
          {
            eventId: `evt-${crew3Alert.alertId}`,
            crewId: 'crew-3',
            metric: crew3Alert.metric ?? null,
            value: crew3Alert.value ?? null,
            zScore: crew3Alert.zScore ?? null,
            message: crew3Alert.message,
            createdAtOnboardMs: now - 4 * 60_000,
            receivedAtMs: now - 4 * 60_000 + 3_000,
          },
        ]
      : [],
  }
}

let sim = initialSimulation()

/** Restart the simulation (tests call this between cases). */
export function resetMockEarth(now = Date.now()) {
  sim = initialSimulation(now)
}

/** Onboard time up to which Earth has every reading: the outbox holds the rest. */
function dataUpToMs(now: number): number {
  return now - (sim.pending / PRODUCED_PER_SECOND) * 1000
}

function advance(now = Date.now()) {
  const seconds = Math.max(0, (now - sim.lastTickMs) / 1000)
  sim.lastTickMs = now
  if (sim.linkEnabled) {
    const before = sim.pending
    sim.pending = Math.max(0, Math.round(sim.pending + seconds * (PRODUCED_PER_SECOND - DRAIN_PER_SECOND)))
    sim.eventsReceived += Math.round(before - sim.pending + seconds * PRODUCED_PER_SECOND)
    sim.lastAckAtMs = now
    if (sim.pending === 0) sim.pendingSinceMs = null
  } else {
    if (sim.pending === 0) sim.pendingSinceMs = now - seconds * 1000
    sim.pending = Math.round(sim.pending + seconds * PRODUCED_PER_SECOND)
    // The story's onboard alert, raised while the link is down.
    if (sim.linkCutAtMs !== null && now - sim.linkCutAtMs >= ALERT_AFTER_CUT_MS && !sim.alerts.some((a) => a.crewId === 'crew-1')) {
      sim.alerts.push({
        eventId: 'evt-mock-crew-1-low-spo2',
        crewId: 'crew-1',
        metric: 'spo2',
        value: 89,
        zScore: -8.2,
        message: 'LOW_SPO2 scenario: SpO₂ crossed |z| >= 3 of the baseline.',
        createdAtOnboardMs: sim.linkCutAtMs + ALERT_AFTER_CUT_MS,
        receivedAtMs: null,
      })
    }
  }
  // Alerts jump the queue (outbox priority): they arrive as soon as the link is up.
  for (const alert of sim.alerts) {
    if (alert.receivedAtMs === null && sim.linkEnabled) alert.receivedAtMs = now
  }
}

function syncStatus(now: number): SyncStatus {
  return {
    linkEnabled: sim.linkEnabled,
    pendingCount: sim.pending,
    pendingAlerts: sim.alerts.filter((a) => a.receivedAtMs === null).length,
    oldestPendingAgeMs: sim.pendingSinceMs === null ? null : now - sim.pendingSinceMs,
    lastAckAtMs: sim.lastAckAtMs,
    lastError: sim.linkEnabled ? null : 'Earth link disabled',
  }
}

function earthCrew(now: number): EarthCrewMember[] {
  const upTo = dataUpToMs(now)
  return fixtures.crew.map((member) => {
    const summary = fixtures.members[member.crewId]?.metrics.metrics ?? []
    const alertForMember = sim.alerts.find((a) => a.crewId === member.crewId && a.receivedAtMs !== null && a.metric)
    return {
      crewId: member.crewId,
      name: member.name,
      role: member.role,
      lastReceivedAtMs: sim.lastAckAtMs,
      metrics: EARTH_METRICS.flatMap((metric) => {
        const reading = summary.find((m) => m.metric === metric)
        if (!reading) return []
        const value = alertForMember?.metric === metric && alertForMember.value !== null ? alertForMember.value : (reading.value ?? null)
        return [{ metric, value, unit: reading.unit, takenAt: upTo, receivedAt: sim.lastAckAtMs }]
      }),
    }
  })
}

export const earthHandlers = [
  http.get(`${ONBOARD_API}/v1/sync/status`, () => {
    const now = Date.now()
    advance(now)
    return HttpResponse.json(syncStatus(now))
  }),

  http.put(`${ONBOARD_API}/v1/sync/link`, async ({ request }) => {
    const now = Date.now()
    advance(now)
    const { enabled } = (await request.json()) as { enabled: boolean }
    if (enabled !== sim.linkEnabled) {
      sim.linkEnabled = enabled
      sim.linkCutAtMs = enabled ? null : now
    }
    return HttpResponse.json(syncStatus(now))
  }),

  http.get(`${EARTH_API}/v1/views/status`, () => {
    const now = Date.now()
    advance(now)
    return HttpResponse.json({ lastReceivedAtMs: sim.lastAckAtMs, eventsReceived: sim.eventsReceived })
  }),

  http.get(`${EARTH_API}/v1/views/crew`, () => {
    const now = Date.now()
    advance(now)
    return HttpResponse.json(earthCrew(now))
  }),

  http.get(`${EARTH_API}/v1/views/alerts`, () => {
    advance()
    const delivered = sim.alerts.filter((a): a is EarthAlert => a.receivedAtMs !== null)
    return HttpResponse.json([...delivered].sort((a, b) => b.createdAtOnboardMs - a.createdAtOnboardMs))
  }),
]
