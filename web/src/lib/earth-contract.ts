// Data shapes the Earth view reads (owner of the APIs: Guilherme).
//
// - SyncStatus mirrors onboard/app/sync/schemas.py on the `feat/outbox-sync` branch.
// - The /v1/views/* shapes are PROVISIONAL: the Earth service does not implement them yet.
//   Everything that depends on them lives here and in earth-api.ts, so adapting to the
//   final endpoints touches only these two files.

/** `GET /api/onboard/v1/sync/status` — the simulated Earth link and the onboard outbox. */
export interface SyncStatus {
  linkEnabled: boolean
  pendingCount: number
  pendingAlerts: number
  oldestPendingAgeMs: number | null
  lastAckAtMs: number | null
  lastError: string | null
}

/** `GET /api/earth/v1/views/status` — what Earth has received (PROVISIONAL). */
export interface EarthStatus {
  lastReceivedAtMs: number | null
  eventsReceived: number
}

export interface EarthMetric {
  metric: string
  value: number | null
  unit: string
  /** When the wearable took the reading (onboard clock). */
  takenAt: number
  /** When the reading reached Earth. */
  receivedAt: number
}

/** `GET /api/earth/v1/views/crew` — latest synced data per crew member (PROVISIONAL). */
export interface EarthCrewMember {
  crewId: string
  name: string
  role: string
  lastReceivedAtMs: number | null
  metrics: EarthMetric[]
}

/** `GET /api/earth/v1/views/alerts` — onboard alerts that reached Earth (PROVISIONAL). */
export interface EarthAlert {
  eventId: string
  crewId: string
  metric: string | null
  value: number | null
  zScore: number | null
  message: string
  createdAtOnboardMs: number
  receivedAtMs: number
}
