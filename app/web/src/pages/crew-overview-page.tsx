import { BellRingIcon, ChevronRightIcon, ClipboardCheckIcon, Clock3Icon, RadioTowerIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AlertBanner } from '@/components/alert-banner'
import { ActionPlanCard } from '@/components/action-plan-card'
import { MissionReadinessCard } from '@/components/mission-readiness-card'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { TrendChart } from '@/components/trend-chart'
import { VitalCard } from '@/components/vital-card'
import { useNow } from '@/hooks/use-now'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import { useSyncStatus } from '@/lib/earth-queries'
import { displayUnit, formatValue, metricDisplay, PRIMARY_VITALS } from '@/lib/metric-catalog'
import { STATUS_STYLES } from '@/lib/metric-status'
import { useActionPlan, useCrewAlerts, useCrewMetrics, useMissionReadiness, useQuestionnaireStatus } from '@/lib/onboard-queries'
import { isAvailable } from '@/lib/questionnaire-status'
import type { CrewSummary, MetricSummary, MissionReadiness } from '@/lib/onboard-types'
import { formatAge } from '@/lib/time'
import { cn } from '@/lib/utils'

/** `/crew/:crewId` index — current levels, the selected trend and onboard alerts. */
export function CrewOverviewPage() {
  const member = useCrewHubMember()
  const metrics = useCrewMetrics(member.crewId)
  const alerts = useCrewAlerts(member.crewId)
  const readiness = useMissionReadiness(member.crewId)
  const actionPlan = useActionPlan(member.crewId)
  const status = useQuestionnaireStatus(member.crewId)
  const sync = useSyncStatus()
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
      {actionPlan.isSuccess && <ActionPlanCard crewId={member.crewId} plan={actionPlan.data} />}
      {actionPlan.isError && <QueryError error={actionPlan.error} title="Could not load your local action plan" onRetry={() => actionPlan.refetch()} />}
      <OperationalSummary
        metrics={metrics.data}
        readiness={readiness.data}
        dailyCheckinDue={status.isSuccess ? isAvailable(status.data.dailyCheckin, now) : null}
        alertCount={alerts.data?.length}
        link={sync.data}
        now={now}
      />
      {alerts.isSuccess && <AlertBanner alerts={alerts.data} now={now} />}
      {readiness.isSuccess && <MissionReadinessCard readiness={readiness.data} />}

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

/** A single, non-clinical glance at the operational signals needed before reviewing details. */
function OperationalSummary({
  metrics,
  readiness,
  dailyCheckinDue,
  alertCount,
  link,
  now,
}: {
  metrics: CrewSummary
  readiness: MissionReadiness | undefined
  dailyCheckinDue: boolean | null
  alertCount: number | undefined
  link: { linkEnabled: boolean; pendingCount: number; pendingAlerts: number; lastError: string | null } | undefined
  now: number
}) {
  const latestReading = metrics.metrics.reduce<number | null>((latest, metric) => {
    const takenAt = metric.takenAt ?? null
    return takenAt !== null && (latest === null || takenAt > latest) ? takenAt : latest
  }, null)
  const needsReview = readiness?.status === 'REVIEW_BEFORE_CRITICAL_TASK'
  const monitor = readiness?.status === 'MONITOR'
  const linkDetail = link?.lastError
    ? 'Needs attention'
    : link?.pendingCount
      ? `${link.pendingCount} queued`
      : 'Queue clear'

  return (
    <section aria-label="Operational summary" className="glass-panel overflow-hidden rounded-3xl border">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary">MISSION SNAPSHOT</p>
          <h2 className="text-lg font-semibold tracking-tight">Operational summary</h2>
        </div>
        <p className="text-sm text-muted-foreground">Live local context</p>
      </header>
      <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-5 sm:divide-y-0">
        <SummaryItem
          label="Readiness"
          value={readiness ? readiness.status.replaceAll('_', ' ') : 'Assessing'}
          detail={readiness ? 'Local mission context' : 'Waiting for context'}
          icon={needsReview || monitor ? TriangleAlertIcon : ShieldCheckIcon}
          tone={needsReview ? 'alert' : monitor ? 'warn' : 'ok'}
        />
        <SummaryItem
          label="Latest sample"
          value={latestReading !== null ? formatAge(latestReading, now) : 'No data'}
          detail={latestReading !== null ? 'Most recent valid metric' : 'No reading received'}
          icon={Clock3Icon}
          tone={latestReading !== null ? 'default' : 'muted'}
        />
        <SummaryItem
          label="Daily check-in"
          value={dailyCheckinDue === null ? 'Checking' : dailyCheckinDue ? 'Due now' : 'Complete'}
          detail={dailyCheckinDue ? 'Takes about 30 seconds' : 'UTC daily window'}
          icon={ClipboardCheckIcon}
          tone={dailyCheckinDue ? 'warn' : 'ok'}
        />
        <SummaryItem
          label="Alerts"
          value={alertCount === undefined ? 'Checking' : `${alertCount} active`}
          detail={alertCount ? 'Review before tasking' : 'No active alerts'}
          icon={BellRingIcon}
          tone={alertCount ? 'alert' : 'ok'}
        />
        <SummaryItem
          label="Data link"
          value={link === undefined ? 'Checking' : link.linkEnabled ? 'Connected' : 'Offline'}
          detail={link === undefined ? 'Link status unavailable' : linkDetail}
          icon={RadioTowerIcon}
          tone={link?.lastError || !link?.linkEnabled ? 'alert' : link.pendingCount ? 'warn' : 'ok'}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </section>
  )
}

type SummaryTone = 'default' | 'ok' | 'warn' | 'alert' | 'muted'

function SummaryItem({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  className,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Clock3Icon
  tone: SummaryTone
  className?: string
}) {
  const tones: Record<SummaryTone, string> = {
    default: 'text-primary',
    ok: 'text-status-ok',
    warn: 'text-status-warn',
    alert: 'text-status-alert',
    muted: 'text-muted-foreground',
  }

  return (
    <div className={cn('min-w-0 space-y-2 px-4 py-4 sm:px-5', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className={cn('size-4 shrink-0', tones[tone])} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn('text-base font-semibold leading-tight sm:text-lg', tones[tone])}>{value}</p>
      <p className="min-h-9 text-xs leading-snug text-muted-foreground">{detail}</p>
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
