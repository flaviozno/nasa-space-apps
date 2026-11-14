export interface TelemetryBatch {
  version: 1;
  transferId: string;
  requestId: string;
  sessionId: string;
  generatedAtMs: number;
  hasMore: boolean;
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
  spo2HundredthsPercent: number | null;
  temperatureHundredthsCelsius: number | null;
  batteryMillivolts: number | null;
  dataSource: "SIMULATED";
}
