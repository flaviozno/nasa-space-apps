// Manual measurements typed in the Crew Hub. Units and ranges mirror contracts/metrics.json;
// step sizes are chosen so a typical change takes a few taps (no keyboard).

export interface ManualMetric {
  metric: string
  label: string
  unit: string
  min: number
  max: number
  decimals: number
  /** [fine, coarse] step for the − / + buttons. */
  steps: readonly [number, number]
}

export const MANUAL_METRICS = {
  body_mass: { metric: 'body_mass', label: 'Body mass', unit: 'kg', min: 40, max: 150, decimals: 1, steps: [0.1, 1] },
  blood_pressure_systolic: {
    metric: 'blood_pressure_systolic',
    label: 'Systolic',
    unit: 'mmHg',
    min: 70,
    max: 200,
    decimals: 0,
    steps: [1, 5],
  },
  blood_pressure_diastolic: {
    metric: 'blood_pressure_diastolic',
    label: 'Diastolic',
    unit: 'mmHg',
    min: 40,
    max: 130,
    decimals: 0,
    steps: [1, 5],
  },
  water_intake: { metric: 'water_intake', label: 'Water intake', unit: 'L/day', min: 0, max: 10, decimals: 1, steps: [0.1, 0.5] },
  grip_strength: { metric: 'grip_strength', label: 'Grip strength', unit: 'kg', min: 10, max: 100, decimals: 0, steps: [1, 5] },
} as const satisfies Record<string, ManualMetric>

export type ManualMetricId = keyof typeof MANUAL_METRICS

/** The measurements as the astronaut sees them: blood pressure is one card with two values. */
export const MEASUREMENT_GROUPS: { id: string; title: string; metrics: ManualMetricId[] }[] = [
  { id: 'blood_pressure', title: 'Blood pressure', metrics: ['blood_pressure_systolic', 'blood_pressure_diastolic'] },
  { id: 'body_mass', title: 'Body mass', metrics: ['body_mass'] },
  { id: 'water_intake', title: 'Water intake', metrics: ['water_intake'] },
  { id: 'grip_strength', title: 'Grip strength', metrics: ['grip_strength'] },
]

/** Adds `delta` and keeps the result inside the metric's range, without float noise (61.8 + 0.1 = 61.9). */
export function stepValue(definition: ManualMetric, value: number, delta: number): number {
  const factor = 10 ** definition.decimals
  const next = Math.round((value + delta) * factor) / factor
  return Math.min(definition.max, Math.max(definition.min, next))
}

/**
 * A typed value, or null when it is not a number or outside the metric's range.
 * Accepts a comma or a dot as decimal separator: "63,4" → 63.4; rounds to the metric's precision.
 */
export function parseTypedValue(definition: ManualMetric, text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const factor = 10 ** definition.decimals
  const value = Math.round(Number(normalized) * factor) / factor
  return value >= definition.min && value <= definition.max ? value : null
}

/** A plausibility check the API does not do: diastolic must be below systolic. */
export function bloodPressureError(systolic: number, diastolic: number): string | null {
  return diastolic >= systolic ? 'Diastolic must be lower than systolic.' : null
}
