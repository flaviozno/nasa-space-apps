// Visual language for the API's ObservationStatus. Every status pairs a color with an icon
// and a word, so it never relies on color alone.

import { CircleCheckIcon, CircleDashedIcon, CircleSlashIcon, ClockAlertIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import type { MetricSummary } from '@/lib/onboard-types'

export type ObservationStatus = MetricSummary['status']

export interface StatusStyle {
  label: string
  icon: LucideIcon
  /** Text color for the chip and accents. */
  text: string
  /** Chip background. */
  chip: string
  /** Card border when the card should draw attention. */
  border: string
}

export const STATUS_STYLES: Record<ObservationStatus, StatusStyle> = {
  OK: {
    label: 'Normal',
    icon: CircleCheckIcon,
    text: 'text-status-ok',
    chip: 'bg-status-ok/15',
    border: 'border-border',
  },
  DEVIATION: {
    label: 'Deviation',
    icon: TriangleAlertIcon,
    text: 'text-status-alert',
    chip: 'bg-status-alert/15',
    border: 'border-status-alert/60',
  },
  STALE: {
    label: 'Stale',
    icon: ClockAlertIcon,
    text: 'text-status-warn',
    chip: 'bg-status-warn/15',
    border: 'border-status-warn/50',
  },
  INVALID: {
    label: 'Invalid',
    icon: CircleSlashIcon,
    text: 'text-status-muted',
    chip: 'bg-status-muted/15',
    border: 'border-border',
  },
  NO_DATA: {
    label: 'No data',
    icon: CircleDashedIcon,
    text: 'text-status-muted',
    chip: 'bg-status-muted/15',
    border: 'border-border border-dashed',
  },
}
