// Contract of GET /api/onboard/v1/environment/radiation?windowMinutes=120
// (onboard/app/environment). The route reads the `radiation` block the wearable ingest stores
// with each reading (`wearable_samples.payload`), drops the repeats, and rebuilds the timeline
// from the NASA timestamps. Field names mirror the emulator's RadiationEvidence
// (emu/src/contracts/telemetry.ts) and onboard's RadiationTrackOut.

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
