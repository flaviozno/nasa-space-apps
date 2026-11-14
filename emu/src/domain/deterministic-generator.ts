import type { Scenario } from "../contracts/sync.ts";
import type { TelemetryReading } from "../contracts/telemetry.ts";
import { hash, seededInteger } from "../utils/hash.ts";
import { acquisitionTime } from "../utils/time.ts";
import type { NasaData } from "./nasa-data.ts";

function exerciseReplay(sequenceNumber: number, data: NasaData) {
  const stages = data.exercise;
  const rest = stages[0]!;
  const peak = stages[stages.length - 1]!;
  const exerciseSeconds = Math.round(peak[5] * 60);
  const recoverySeconds = 300;
  const elapsedSeconds = sequenceNumber % (exerciseSeconds + recoverySeconds);
  if (elapsedSeconds > exerciseSeconds) {
    const fraction = (elapsedSeconds - exerciseSeconds) / recoverySeconds;
    return {
      heartRateBpm: Math.round(peak[6] + (rest[6] - peak[6]) * fraction),
      origin: "NASA_ANALOG_DERIVED_RECOVERY" as const,
      evidence: {
        sourceDate: peak[3], subjectCode: peak[2], phase: "SIMULATED_RECOVERY" as const,
        elapsedSeconds, fromStage: peak[4], toStage: rest[4],
        fromSourceHeartRateBpm: peak[6], toSourceHeartRateBpm: rest[6],
        fromSourceRecordId: peak[1], toSourceRecordId: rest[1],
        fromSourceFileKey: peak[0], toSourceFileKey: rest[0],
        simulatedWorkloadWatts: Math.round(peak[7] * (1 - fraction)),
      },
    };
  }
  if (elapsedSeconds === exerciseSeconds) {
    const previous = stages[stages.length - 2]!;
    return {
      heartRateBpm: peak[6], origin: "NASA_ANALOG_INTERPOLATED" as const,
      evidence: {
        sourceDate: peak[3], subjectCode: peak[2], phase: "EXERCISE" as const,
        elapsedSeconds, fromStage: previous[4], toStage: peak[4],
        fromSourceHeartRateBpm: previous[6], toSourceHeartRateBpm: peak[6],
        fromSourceRecordId: previous[1], toSourceRecordId: peak[1], simulatedWorkloadWatts: peak[7],
        fromSourceFileKey: previous[0], toSourceFileKey: peak[0],
      },
    };
  }
  const upperIndex = stages.findIndex((stage, index) => index > 0 && elapsedSeconds <= stage[5] * 60);
  const from = stages[upperIndex - 1]!;
  const to = stages[upperIndex]!;
  const fromSeconds = from[5] * 60;
  const fraction = (elapsedSeconds - fromSeconds) / (to[5] * 60 - fromSeconds);
  return {
    heartRateBpm: Math.round(from[6] + (to[6] - from[6]) * fraction),
    origin: "NASA_ANALOG_INTERPOLATED" as const,
    evidence: {
      sourceDate: to[3], subjectCode: to[2], phase: "EXERCISE" as const,
      elapsedSeconds, fromStage: from[4], toStage: to[4],
      fromSourceHeartRateBpm: from[6], toSourceHeartRateBpm: to[6],
      fromSourceRecordId: from[1], toSourceRecordId: to[1],
      fromSourceFileKey: from[0], toSourceFileKey: to[0],
      simulatedWorkloadWatts: Math.round(from[7] + (to[7] - from[7]) * fraction),
    },
  };
}

export function generateReading(
  deviceId: string,
  bootId: string,
  sequenceNumber: number,
  sessionId: string,
  scenario: Scenario,
  nasaData: NasaData,
): TelemetryReading {
  const identity = [deviceId, bootId, sequenceNumber];
  const seed = hash([...identity, sessionId, scenario]);
  const invalid = seededInteger(seed, "invalid", 0, 99) === 0;
  const subjects = [...new Set(nasaData.actigraphy.filter((row) => row[6] !== null).map((row) => row[1]))].sort();
  const subject = subjects[seededInteger(hash([deviceId, bootId]), "nasa-subject", 0, subjects.length - 1)]!;
  const sleepRows = nasaData.actigraphy.filter((row) => row[1] === subject && row[6] !== null).sort((a, b) => a[4].localeCompare(b[4]) || a[0] - b[0]);
  const sleepDay = Math.floor(sequenceNumber / 86_400);
  const sleep = sleepRows[sleepDay % sleepRows.length]!;
  const radiation = nasaData.radiation[sequenceNumber % nasaData.radiation.length]!;
  const exercise = scenario === "NASA_EXERCISE_REPLAY" ? exerciseReplay(sequenceNumber, nasaData) : null;
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
      : exercise?.heartRateBpm ?? seededInteger(
          seed,
          "hr",
          scenario === "ELEVATED_HEART_RATE" ? 130 : 60,
          scenario === "ELEVATED_HEART_RATE" ? 180 : 95,
        ),
    heartRateOrigin: exercise?.origin ?? "SIMULATED",
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
    nasaReplay: {
      sleep: {
        sourceRecordId: sleep[0],
        subjectCode: sleep[1],
        phase: sleep[2],
        sourceDate: sleep[4],
        bedRestDay: sleep[3],
        latencyMinutes: sleep[5],
        durationMinutes: sleep[6]!,
        efficiencyPercent: sleep[7],
        note: sleep[8],
      },
      radiation: {
        sourceTimestamp: radiation[0],
        instrumentId: radiation[1],
        absorbedDoseRateMicroGyPerHour: radiation[2],
        latitudeDegrees: radiation[3],
        longitudeDegrees: radiation[4],
        altitudeKilometers: radiation[5],
        particleFluxPerCm2SrSecond: radiation[6],
      },
      exercise: exercise?.evidence ?? null,
    },
  };
}
