import type { SyncRequest } from "../contracts/sync.ts";
import type {
  TelemetryBatch,
  TelemetryReading,
} from "../contracts/telemetry.ts";
import { hash } from "../utils/hash.ts";
import { acquisitionTime, MAX_SEQUENCE } from "../utils/time.ts";
import { generateReading } from "./deterministic-generator.ts";
import { ACTIGRAPHY_URL, EXERCISE_PEAK_URL, EXERCISE_REST_URL, RADIATION_URL, type NasaData } from "./nasa-data.ts";
export function simulate(request: SyncRequest, nasaData: NasaData): TelemetryBatch {
  const cursors = request.devices.map((device) => ({ ...device }));
  const readings: TelemetryReading[] = [];
  const eligible = () =>
    cursors
      .filter(
        (d) =>
          d.fromSequence <= MAX_SEQUENCE &&
          acquisitionTime(d.fromSequence) <= request.untilAcquiredAtMs,
      )
      .sort(
        (a, b) =>
          a.fromSequence - b.fromSequence ||
          (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0) ||
          (a.bootId < b.bootId ? -1 : a.bootId > b.bootId ? 1 : 0),
      );
  while (readings.length < request.maxRecords) {
    const next = eligible()[0];
    if (!next) break;
    readings.push(
      generateReading(
        next.deviceId,
        next.bootId,
        next.fromSequence,
        request.sessionId,
        request.scenario,
        nasaData,
      ),
    );
    next.fromSequence += 1;
  }
  const content = {
    version: 1 as const,
    requestId: request.requestId,
    sessionId: request.sessionId,
    generatedAtMs: request.requestedAtMs,
    hasMore: eligible().length > 0,
    nasaSources: {
      revision: nasaData.revision,
      actigraphyUrl: ACTIGRAPHY_URL,
      radiationUrl: RADIATION_URL,
      exerciseRestUrl: EXERCISE_REST_URL,
      exercisePeakUrl: EXERCISE_PEAK_URL,
    },
    readings,
  };
  return {
    ...content,
    transferId: `transfer_${hash([request.requestId, content])}`,
  };
}
