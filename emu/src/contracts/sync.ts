export type Scenario = "NORMAL" | "ELEVATED_HEART_RATE" | "LOW_SPO2";
export interface SyncRequest {
  version: 1;
  requestId: string;
  sessionId: string;
  requestedAtMs: number;
  scenario: Scenario;
  devices: Array<{ deviceId: string; bootId: string; fromSequence: number }>;
  maxRecords: number; // Máximo TOTAL: 100, não por dispositivo.
  untilAcquiredAtMs: number;
}
