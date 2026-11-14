export interface TelemetryBatch {
  version: 1;
  transferId: string;
  requestId: string;
  sessionId: string;
  generatedAtMs: number;
  hasMore: boolean;
  nasaSources: {
    revision: string;
    actigraphyUrl: string;
    radiationUrl: string;
    exerciseRestUrl: string;
    exercisePeakUrl: string;
  };
  readings: TelemetryReading[];
}
export interface TelemetryReading {
  sampleId: string;
  deviceId: string;
  bootId: string;
  sequenceNumber: number;
  acquiredAtMs: number;
  validityMask: number;
  sensorStatus: "VALID" | "INVALID" | "DEGRADED";
  heartRateBpm: number | null;
  heartRateOrigin: "SIMULATED" | "NASA_ANALOG_INTERPOLATED" | "NASA_ANALOG_DERIVED_RECOVERY";
  spo2HundredthsPercent: number | null;
  temperatureHundredthsCelsius: number | null;
  batteryMillivolts: number | null;
  dataSource: "SIMULATED";
  nasaReplay: {
    sleep: {
      sourceRecordId: number;
      subjectCode: string;
      phase: string;
      sourceDate: string;
      bedRestDay: number;
      latencyMinutes: number | null;
      durationMinutes: number;
      efficiencyPercent: number | null;
      note: string | null;
    };
    radiation: {
      sourceTimestamp: string;
      instrumentId: string;
      absorbedDoseRateMicroGyPerHour: number;
      latitudeDegrees: number | null;
      longitudeDegrees: number | null;
      altitudeKilometers: number | null;
      particleFluxPerCm2SrSecond: number | null;
    };
    exercise: null | {
      sourceDate: string;
      subjectCode: string;
      phase: "EXERCISE" | "SIMULATED_RECOVERY";
      elapsedSeconds: number;
      fromStage: string;
      toStage: string;
      fromSourceHeartRateBpm: number;
      toSourceHeartRateBpm: number;
      fromSourceRecordId: number;
      toSourceRecordId: number;
      fromSourceFileKey: "SUBMAX_SUMMARY" | "PEAK_SUMMARY";
      toSourceFileKey: "SUBMAX_SUMMARY" | "PEAK_SUMMARY";
      simulatedWorkloadWatts: number;
    };
  };
}
