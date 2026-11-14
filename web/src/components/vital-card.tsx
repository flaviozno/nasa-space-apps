import { ZGauge } from '@/components/z-gauge'
import { describeZ, displayUnit, formatValue, metricDisplay } from '@/lib/metric-catalog'
import { STATUS_STYLES } from '@/lib/metric-status'
import type { MetricSummary } from '@/lib/onboard-types'
import { formatAge } from '@/lib/time'
import { cn } from '@/lib/utils'

interface VitalCardProps {
  summary: MetricSummary
  selected: boolean
  onSelect: () => void
  now: number
}

/**
 * Big touch card for one live vital: value readable at a glance, status as color + icon + word,
 * and where the value sits against the astronaut's own baseline. Tapping it shows its trend.
 */
export function VitalCard({ summary, selected, onSelect, now }: VitalCardProps) {
  const status = STATUS_STYLES[summary.status]
  const StatusIcon = status.icon
  const { label } = metricDisplay(summary.metric, summary.label)
  const hasValue = summary.value !== null && summary.value !== undefined
  const z = summary.zScore

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-44 flex-col gap-3 rounded-2xl border-2 bg-card p-5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 active:bg-accent',
        selected ? 'border-primary bg-accent/60' : status.border,
      )}
    >
      <span className="flex w-full flex-wrap items-center justify-between gap-2">
        <span className="text-base font-medium whitespace-nowrap text-muted-foreground">{label}</span>
        <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold', status.text, status.chip)}>
          <StatusIcon className="size-4" aria-hidden="true" />
          {status.label}
        </span>
      </span>

      <span className="flex items-baseline gap-2">
        <span className={cn('text-5xl font-semibold tracking-tight tabular-nums', !hasValue && 'text-muted-foreground')}>
          {formatValue(summary.metric, summary.value)}
        </span>
        <span className="text-lg text-muted-foreground">{displayUnit(summary.unit)}</span>
      </span>

      {hasValue && z !== null && z !== undefined ? (
        <span className="flex flex-col gap-2">
          <ZGauge z={z} dotClass={summary.status === 'DEVIATION' ? 'bg-status-alert' : 'bg-primary'} />
          <span className="text-sm text-muted-foreground">{describeZ(z)}</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          {summary.status === 'NO_DATA' ? 'Sensor not reporting — not shown as normal' : 'No valid reading in the last batch'}
        </span>
      )}

      <span className="mt-auto text-xs text-muted-foreground">
        {summary.takenAt ? `Updated ${formatAge(summary.takenAt, now)}` : 'Never received'}
      </span>
    </button>
  )
}
