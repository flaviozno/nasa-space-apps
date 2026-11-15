import { createHash } from "node:crypto";
export function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function seededInteger(
  seed: string,
  label: string,
  min: number,
  max: number,
): number {
  const value = Number.parseInt(hash([seed, label]).slice(0, 8), 16);
  return min + (value % (max - min + 1));
}
