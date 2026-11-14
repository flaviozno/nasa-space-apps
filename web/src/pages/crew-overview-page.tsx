import { ChevronRightIcon, ClipboardCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AlertBanner } from '@/components/alert-banner'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { TrendChart } from '@/components/trend-chart'
import { VitalCard } from '@/components/vital-card'
import { useNow } from '@/hooks/use-now'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import { displayUnit, formatValue, metricDisplay, PRIMARY_VITALS } from '@/lib/metric-catalog'
import { STATUS_STYLES } from '@/lib/metric-status'
import { useCrewAlerts, useCrewMetrics, useQuestionnaireStatus } from '@/lib/onboard-queries'
import { isAvailable } from '@/lib/questionnaire-status'
import type { MetricSummary } from '@/lib/onboard-types'
import { formatAge } from '@/lib/time'
import { cn } from '@/lib/utils'

/** `/crew/:crewId` index — current levels, the selected trend and onboard alerts. */
export function CrewOverviewPage() {
  const member = useCrewHubMember()
  const metrics = useCrewMetrics(member.crewId)
  const alerts = useCrewAlerts(member.crewId)
  const status = useQuestionnaireStatus(member.crewId)
  const now = useNow()
  const [chosenMetric, setChosenMetric] = useState<string | null>(null)
  const [windowMinutes, setWindowMinutes] = useState(30)

  if (metrics.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          {PRIMARY_VITALS.map((metric) => (
            <LoadingBlock key={metric} className="h-52" />
          ))}
        </div>
        <LoadingBlock className="h-96" />
      </div>
    )
  }
  if (metrics.isError) {
    return <QueryError error={metrics.error} title="Could not load your metrics" onRetry={() => metrics.refetch()} />
  }

  const byMetric = new Map(metrics.data.metrics.map((summary) => [summary.metric, summary]))
  const vitals = PRIMARY_VITALS.flatMap((metric) => byMetric.get(metric) ?? [])
  const others = metrics.data.metrics.filter(
    (summary) => !PRIMARY_VITALS.includes(summary.metric as (typeof PRIMARY_VITALS)[number]) && summary.status !== 'NO_DATA',
  )
  // Open on the vital that needs attention, if any; otherwise heart rate.
  const selected = chosenMetric ?? vitals.find((v) => v.status === 'DEVIATION')?.metric ?? 'heart_rate'

  return (
    <div className="space-y-4">
      {alerts.isSuccess && <AlertBanner alerts={alerts.data} now={now} />}

      {status.isSuccess && isAvailable(status.data.dailyCheckin, now) && (
        <Link
          to="checkin"
          className="flex min-h-20 items-center gap-4 rounded-2xl border-2 border-status-warn/60 bg-status-warn/10 px-5 py-4 transition-colors active:bg-status-warn/20"
        >
          <ClipboardCheckIcon className="size-8 shrink-0 text-status-warn" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-xl font-semibold">Daily check-in due</span>
            <span className="block text-base text-muted-foreground">About 30 seconds — how you feel and any symptoms.</span>
          </span>
          <span className="flex items-center gap-1 text-lg font-semibold text-status-warn">
            Start
            <ChevronRightIcon className="size-6" aria-hidden="true" />
          </span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Current levels" className="grid grid-cols-2 content-start gap-4">
          {vitals.map((summary) => (
            <VitalCard
              key={summary.metric}
              summary={summary}
              selected={summary.metric === selected}
              onSelect={() => setChosenMetric(summary.metric)}
              now={now}
            />
          ))}
        </section>
        <TrendChart
          crewId={member.crewId}
          metric={selected}
          windowMinutes={windowMinutes}
          onWindowChange={setWindowMinutes}
        />
      </div>

      {others.length > 0 && (
        <section aria-label="Other metrics" className="space-y-2">
          <h2 className="text-2xl font-semibold">Check-ins and measurements</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {others.map((summary) => (
              <MetricTile
                key={summary.metric}
                summary={summary}
                selected={summary.metric === selected}
                onSelect={() => setChosenMetric(summary.metric)}
                now={now}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Compact touch tile for self-reported and manual metrics; tapping shows its trend above. */
function MetricTile({ summary, selected, onSelect, now }: { summary: MetricSummary; selected: boolean; onSelect: () => void; now: number }) {
  const status = STATUS_STYLES[summary.status]
  const StatusIcon = status.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-28 flex-col gap-1.5 rounded-2xl border-2 bg-card px-5 py-4 text-left transition-colors active:bg-accent',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
        selected ? 'border-primary' : status.border,
      )}
    >
      <span className="flex items-center justify-between gap-2 text-lg text-muted-foreground">
        {metricDisplay(summary.metric, summary.label).label}
        <StatusIcon className={cn('size-5', status.text)} aria-label={status.label} />
      </span>
      <span className="font-mono text-4xl font-semibold tabular-nums">
        {formatValue(summary.metric, summary.value)}
        <span className="ml-1.5 text-lg font-normal text-muted-foreground">{displayUnit(summary.unit)}</span>
      </span>
      {summary.takenAt && <span className="text-sm text-muted-foreground">{formatAge(summary.takenAt, now)}</span>}
    </button>
  )
}
