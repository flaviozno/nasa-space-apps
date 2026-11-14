import { SirenIcon } from 'lucide-react'
import { formatValue, metricDisplay } from '@/lib/metric-catalog'
import type { Alert } from '@/lib/onboard-types'
import { formatAge, formatClock } from '@/lib/time'

/**
 * Onboard alerts for one astronaut, newest first. They come from local rules, so they work
 * without the Earth link. Renders nothing when there are no alerts.
 */
export function AlertBanner({ alerts, now }: { alerts: Alert[]; now: number }) {
  if (alerts.length === 0) return null
  const sorted = [...alerts].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <section role="alert" aria-label="Onboard alerts" className="space-y-2">
      {sorted.map((alert, index) => {
        const label = alert.metric ? metricDisplay(alert.metric).label : 'Alert'
        const detail = [
          alert.metric && alert.value !== null && alert.value !== undefined ? `${label} ${formatValue(alert.metric, alert.value)}` : null,
          alert.zScore !== null && alert.zScore !== undefined ? `z = ${alert.zScore.toFixed(1)}` : null,
          `${formatClock(alert.createdAt)} · ${formatAge(alert.createdAt, now)}`,
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <div
            key={alert.alertId}
            className={
              index === 0
                ? 'flex items-start gap-4 rounded-2xl border-2 border-status-alert/70 bg-status-alert/10 p-4 animate-in fade-in slide-in-from-top-2'
                : 'flex items-start gap-4 rounded-xl border border-status-alert/40 bg-status-alert/5 px-4 py-3'
            }
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-status-alert/20 text-status-alert">
              <SirenIcon className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-xl font-semibold">{alert.message}</p>
              <p className="text-base text-muted-foreground">
                {detail} · rule {alert.ruleId} v{alert.ruleVersion}
              </p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
