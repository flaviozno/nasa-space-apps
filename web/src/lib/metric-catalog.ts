// How each metric from contracts/metrics.json is shown in the UI. Units come from the API;
// this file only adds display names, precision and grouping.

export type MetricGroup = 'vitals' | 'wellbeing' | 'symptoms' | 'body' | 'weekly' | 'activity'

export interface MetricDisplay {
  label: string
  decimals: number
  group: MetricGroup
}

const CATALOG: Record<string, MetricDisplay> = {
  heart_rate: { label: 'Heart rate', decimals: 0, group: 'vitals' },
  spo2: { label: 'SpO₂', decimals: 1, group: 'vitals' },
  body_temp: { label: 'Body temp', decimals: 1, group: 'vitals' },
  resp_rate: { label: 'Resp. rate', decimals: 0, group: 'vitals' },
  hrv_rmssd: { label: 'HRV (RMSSD)', decimals: 0, group: 'vitals' },
  sleep_duration: { label: 'Sleep', decimals: 1, group: 'activity' },
  exercise_duration: { label: 'Exercise', decimals: 0, group: 'activity' },
  body_mass: { label: 'Body mass', decimals: 1, group: 'body' },
  blood_pressure_systolic: { label: 'BP systolic', decimals: 0, group: 'body' },
  blood_pressure_diastolic: { label: 'BP diastolic', decimals: 0, group: 'body' },
  water_intake: { label: 'Water', decimals: 1, group: 'body' },
  grip_strength: { label: 'Grip strength', decimals: 0, group: 'body' },
  mood: { label: 'Mood', decimals: 0, group: 'wellbeing' },
  stress: { label: 'Stress', decimals: 0, group: 'wellbeing' },
  fatigue: { label: 'Fatigue', decimals: 0, group: 'wellbeing' },
  sleepiness: { label: 'Sleepiness', decimals: 0, group: 'wellbeing' },
  symptom_headache: { label: 'Headache', decimals: 0, group: 'symptoms' },
  symptom_back_pain: { label: 'Back pain', decimals: 0, group: 'symptoms' },
  symptom_congestion: { label: 'Congestion', decimals: 0, group: 'symptoms' },
  symptom_eye_irritation: { label: 'Eye irritation', decimals: 0, group: 'symptoms' },
  symptom_skin: { label: 'Skin', decimals: 0, group: 'symptoms' },
  symptom_nausea: { label: 'Nausea', decimals: 0, group: 'symptoms' },
  phq4: { label: 'PHQ-4', decimals: 0, group: 'weekly' },
  team_climate: { label: 'Team climate', decimals: 0, group: 'weekly' },
}

/** The four live vitals shown as big cards on the Crew Hub overview, in this order. */
export const PRIMARY_VITALS = ['heart_rate', 'spo2', 'body_temp', 'resp_rate'] as const

/** Display info for a metric; unknown ids fall back to the API label. */
export function metricDisplay(metric: string, apiLabel?: string): MetricDisplay {
  return CATALOG[metric] ?? { label: apiLabel ?? metric, decimals: 1, group: 'vitals' }
}

/** `formatValue('spo2', 98.39)` → "98.4"; null → "—" (a missing reading is never shown as 0). */
export function formatValue(metric: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(metricDisplay(metric).decimals)
}

/** "+1.3σ above your baseline" / "−0.4σ below your baseline". */
export function describeZ(z: number): string {
  const sign = z >= 0 ? '+' : '−'
  return `${sign}${Math.abs(z).toFixed(1)}σ ${z >= 0 ? 'above' : 'below'} your baseline`
}

/** Units the API writes in a way that reads badly at large sizes. */
export function displayUnit(unit: string): string {
  return unit === 'score' ? '' : unit
}
