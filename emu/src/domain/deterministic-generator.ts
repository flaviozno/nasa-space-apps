import type { Scenario } from "../contracts/sync.ts";
import type { TelemetryReading } from "../contracts/telemetry.ts";
import { hash, seededInteger } from "../utils/hash.ts";
import { acquisitionTime } from "../utils/time.ts";
export function generateReading(
  deviceId: string,
  bootId: string,
  sequenceNumber: number,
  sessionId: string,
  scenario: Scenario,
): TelemetryReading {
  const identity = [deviceId, bootId, sequenceNumber];
  const seed = hash([...identity, sessionId, scenario]);
  const invalid = seededInteger(seed, "invalid", 0, 99) === 0;
  return {
    sampleId: `sample_${hash(identity)}`,
    deviceId,
    bootId,
    sequenceNumber,
    acquiredAtMs: acquisitionTime(sequenceNumber),
    validityMask: invalid ? 0 : 15,
    sensorStatus: invalid ? "INVALID" : "VALID",
    heartRateBpm: invalid
      ? null
      : seededInteger(
          seed,
          "hr",
          scenario === "ELEVATED_HEART_RATE" ? 130 : 60,
          scenario === "ELEVATED_HEART_RATE" ? 180 : 95,
        ),
    spo2HundredthsPercent: invalid
      ? null
      : seededInteger(
          seed,
          "spo2",
          scenario === "LOW_SPO2" ? 8500 : 9600,
          scenario === "LOW_SPO2" ? 9200 : 10000,
        ),
    temperatureHundredthsCelsius: invalid
      ? null
      : seededInteger(seed, "temperature", 3600, 3750),
    batteryMillivolts: invalid
      ? null
      : seededInteger(seed, "battery", 3500, 4200),
    dataSource: "SIMULATED",
  };
}
