export const ACQUISITION_EPOCH_MS = 1767225600000;
export const ACQUISITION_INTERVAL_MS = 1000;
export const MAX_SEQUENCE = Math.floor(
  (Number.MAX_SAFE_INTEGER - ACQUISITION_EPOCH_MS) / ACQUISITION_INTERVAL_MS,
);
export function acquisitionTime(sequence: number): number {
  return ACQUISITION_EPOCH_MS + sequence * ACQUISITION_INTERVAL_MS;
}
