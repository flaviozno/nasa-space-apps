// Data shapes the Earth view reads (owner of the APIs: Guilherme).
//
// - SyncStatus mirrors onboard/app/sync/schemas.py.
// - The /v1/views/* shapes mirror earth/app/views/schemas.py (camelCase JSON). Earth computes
//   freshness (FRESH / STALE / MISSING, threshold in earth config: 10 min) and delivery delay
//   itself, so the page shows those instead of recomputing them.

/** `GET /api/onboard/v1/sync/status` — the simulated Earth link and the onboard outbox. */
export interface SyncStatus {
  linkEnabled: boolean
  pendingCount: number
  pendingAlerts: number
  oldestPendingAgeMs: number | null
  lastAckAtMs: number | null
  lastError: string | null
}

/** FRESH: recent; STALE: older than Earth's threshold, never show it as current; MISSING: nothing yet. */
export type Freshness = 'FRESH' | 'STALE' | 'MISSING'

/** `GET /api/earth/v1/views/status` — what Earth has received. */
export interface EarthStatus {
  generatedAtMs: number
  lastReceivedAtMs: number | null
  newestDataAgeMs: number | null
  observationEvents: number
  alertEvents: number
  /** Events Earth rejected because the same id arrived with different content. */
  conflicts: number
  averageDeliveryDelayMs: number | null
}

export interface EarthMetric {
  metric: string
  value: number | null
  unit: string
  /** When the reading was taken (onboard clock). */
  takenAtMs: number
  dataAgeMs: number
  freshness: Freshness
}

/** `GET /api/earth/v1/views/crew` — latest synced data per crew member. */
export interface EarthCrewMember {
  crewId: string
  name: string
  role: string
  freshness: Freshness
  lastMeasuredAtMs: number | null
  dataAgeMs: number | null
  alertCount: number
  metrics: EarthMetric[]
}

/** One compact, traceable item behind a readiness recommendation (hub_common AlertEvidence). */
export interface AlertEvidence {
  id: string
  label: string
  value: number
  unit: string
  takenAt: number
  source: string
  sourceRef: string
  detail?: string | null
}

/** `GET /api/earth/v1/views/alerts` — onboard alerts that reached Earth, newest first. */
export interface EarthAlert {
  eventId: string
  crewId: string
  alertId: string
  ruleId: string
  metric: string | null
  value: number | null
  zScore: number | null
  message: string
  createdAtOnboardMs: number
  /** When Earth received it. */
  receivedAtMs: number
  dataAgeMs: number
  /** receivedAtMs − createdAtOnboardMs, computed by Earth. */
  deliveryDelayMs: number
  recommendationStatus?: 'READY' | 'MONITOR' | 'REVIEW_BEFORE_CRITICAL_TASK' | null
  evidence?: AlertEvidence[]
  disclaimer?: string | null
}
