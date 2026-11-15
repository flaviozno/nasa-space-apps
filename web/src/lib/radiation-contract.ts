// PROVISIONAL contract for the station radiation view. No backend route exists yet: the
// onboard ingest already stores each wearable reading's `radiation` block (raw payload in
// `wearable_samples`), but nothing serves it. Field names mirror the emulator's
// RadiationEvidence (emu/src/contracts/telemetry.ts) so the route can pass them through.
//
// Proposed route: GET /api/onboard/v1/environment/radiation?windowMinutes=120

/** One ISS DosTel reading. Environmental, not a crew member's personal dose. */
export interface RadiationSample {
  /** When onboard acquired the reading (Unix ms). */
  takenAtMs: number
  /** The original NASA timestamp of the source record (ISO 8601). */
  sourceTimestamp: string
  instrumentId: string
  absorbedDoseRateMicroGyPerHour: number
  latitudeDegrees: number | null
  longitudeDegrees: number | null
  altitudeKilometers: number | null
  particleFluxPerCm2SrSecond: number | null
}

export interface RadiationTrack {
  generatedAtMs: number
  windowMinutes: number
  /** Where the readings come from, shown to the user. */
  source: string
  /** Oldest first. */
  samples: RadiationSample[]
}
