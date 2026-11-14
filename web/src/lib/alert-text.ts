// Turns an onboard alert into short, human wording. The API's `message` is technical
// ("ELEVATED_HEART_RATE scenario: heart rate crossed |z| >= 3 of the baseline."), so the UI
// builds its own sentence from the metric, value and z-score.

import { formatValue } from '@/lib/metric-catalog'

/** How a metric reads inside a sentence, and its unit (alerts carry no unit). */
const METRIC_WORDING: Record<string, { phrase: string; unit: string }> = {
  heart_rate: { phrase: 'heart rate', unit: 'bpm' },
  spo2: { phrase: 'SpO₂', unit: '%' },
  body_temp: { phrase: 'body temperature', unit: '°C' },
  resp_rate: { phrase: 'respiratory rate', unit: 'br/min' },
  hrv_rmssd: { phrase: 'heart rate variability', unit: 'ms' },
}

export interface AlertFields {
  metric?: string | null
  value?: number | null
  zScore?: number | null
  message: string
}

export interface AlertText {
  /** "High heart rate" */
  title: string
  /** "125 bpm", or null when the alert has no value */
  reading: string | null
  /** "5.0σ above your baseline", or null without a z-score */
  deviation: string | null
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Example: `{ metric: 'heart_rate', value: 125, zScore: 5 }` →
 * `{ title: 'High heart rate', reading: '125 bpm', deviation: '5.0σ above your baseline' }`.
 */
export function describeAlert(alert: AlertFields, whose: 'your' | 'the' = 'your'): AlertText {
  const wording = alert.metric ? METRIC_WORDING[alert.metric] : undefined
  const z = alert.zScore ?? null
  const direction = z === null ? null : z >= 0 ? 'High' : 'Low'

  const title = wording
    ? direction
      ? `${direction} ${wording.phrase}`
      : capitalize(wording.phrase)
    : // Unknown metric: fall back to the API text without the code-style tokens.
      capitalize(alert.message.split(':')[0].replace(/_/g, ' ').toLowerCase().replace(/\s*scenario$/, ''))

  const reading =
    alert.metric && alert.value !== null && alert.value !== undefined
      ? `${formatValue(alert.metric, alert.value)}${wording ? ` ${wording.unit}` : ''}`
      : null

  const deviation = z === null ? null : `${Math.abs(z).toFixed(1)}σ ${z >= 0 ? 'above' : 'below'} ${whose} baseline`

  return { title, reading, deviation }
}
