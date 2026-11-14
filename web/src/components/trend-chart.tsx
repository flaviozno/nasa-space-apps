import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { displayUnit, metricDisplay } from '@/lib/metric-catalog'
import { useBaseline, useMetricTrend } from '@/lib/onboard-queries'
import { formatClock } from '@/lib/time'
import { cn } from '@/lib/utils'

const TREND_WINDOWS = [
  { minutes: 30, label: '30 min' },
  { minutes: 120, label: '2 h' },
  { minutes: 360, label: '6 h' },
] as const

interface TrendChartProps {
  crewId: string
  metric: string
  windowMinutes: number
  onWindowChange: (minutes: number) => void
}

/** Trend of one metric with the astronaut's normal range (median ± 2σ) shaded behind it. */
export function TrendChart({ crewId, metric, windowMinutes, onWindowChange }: TrendChartProps) {
  const trend = useMetricTrend(crewId, metric, { windowMinutes, maxPoints: 60 })
  const baseline = useBaseline(crewId)
  const { label, decimals } = metricDisplay(metric)

  const reference = baseline.data?.baselines.find((b) => b.metric === metric)
  const band = reference ? { low: reference.median - 2 * reference.spread, high: reference.median + 2 * reference.spread } : null
  const points = trend.data?.points ?? []
  const values = points.flatMap((p) => (p.value === null || p.value === undefined ? [] : [p.value]))
  const unit = displayUnit(trend.data?.unit ?? reference?.unit ?? '')

  const lows = [...values, ...(band ? [band.low] : [])]
  const highs = [...values, ...(band ? [band.high] : [])]
  const pad = lows.length ? (Math.max(...highs) - Math.min(...lows)) * 0.1 || 1 : 1
  const domain: [number, number] = lows.length ? [Math.min(...lows) - pad, Math.max(...highs) + pad] : [0, 1]

  const config = { value: { label, color: 'var(--chart-1)' } } satisfies ChartConfig

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5" aria-label={`${label} trend`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {label}
            {unit && <span className="ml-2 text-base font-normal text-muted-foreground">{unit}</span>}
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-3 w-5 rounded-sm bg-primary/20 ring-1 ring-primary/40" aria-hidden="true" />
            Your normal range (median ± 2σ)
          </p>
        </div>
        <div role="group" aria-label="Time window" className="flex gap-1 rounded-xl bg-muted p-1">
          {TREND_WINDOWS.map((option) => (
            <button
              key={option.minutes}
              type="button"
              aria-pressed={windowMinutes === option.minutes}
              onClick={() => onWindowChange(option.minutes)}
              className={cn(
                'h-12 min-w-16 rounded-lg px-4 text-base font-semibold transition-colors',
                windowMinutes === option.minutes ? 'bg-primary text-primary-foreground' : 'text-muted-foreground active:bg-accent',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {trend.isPending && <LoadingBlock className="h-64 flex-1" />}
      {trend.isError && <QueryError error={trend.error} title="Could not load the trend" onRetry={() => trend.refetch()} />}
      {trend.isSuccess && values.length === 0 && (
        <div className="flex h-64 flex-1 items-center justify-center rounded-xl border border-dashed text-lg text-muted-foreground">
          No readings in this window
        </div>
      )}
      {trend.isSuccess && values.length > 0 && (
        <ChartContainer config={config} className="aspect-auto h-64 w-full flex-1">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            {band && <ReferenceArea y1={band.low} y2={band.high} fill="var(--primary)" fillOpacity={0.1} ifOverflow="hidden" />}
            {band && <ReferenceLine y={band.low} stroke="var(--primary)" strokeOpacity={0.45} strokeDasharray="2 4" />}
            {band && <ReferenceLine y={band.high} stroke="var(--primary)" strokeOpacity={0.45} strokeDasharray="2 4" />}
            {reference && <ReferenceLine y={reference.median} stroke="var(--primary)" strokeOpacity={0.6} strokeDasharray="6 6" />}
            <XAxis
              dataKey="takenAt"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatClock}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              fontSize={13}
            />
            <YAxis
              domain={domain}
              tickFormatter={(v: number) => v.toFixed(decimals)}
              tickLine={false}
              axisLine={false}
              width={44}
              fontSize={13}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const takenAt = payload?.[0]?.payload?.takenAt as number | undefined
                    return takenAt ? formatClock(takenAt) : ''
                  }}
                />
              }
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={3}
              fill="url(#trend-fill)"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </section>
  )
}
