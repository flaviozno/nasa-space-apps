import { ChevronDownIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import type { MissionReadiness } from '@/lib/onboard-types'
import { formatClock } from '@/lib/time'
import { cn } from '@/lib/utils'

const labels = {
  READY: 'READY',
  MONITOR: 'MONITOR',
  REVIEW_BEFORE_CRITICAL_TASK: 'REVIEW BEFORE CRITICAL TASK',
} as const

/** A concise, inspectable operational state — not a clinical score or diagnosis. */
export function MissionReadinessCard({ readiness }: { readiness: MissionReadiness }) {
  const [expanded, setExpanded] = useState(false)
  const review = readiness.status === 'REVIEW_BEFORE_CRITICAL_TASK'
  const monitor = readiness.status === 'MONITOR'
  const Icon = review || monitor ? TriangleAlertIcon : ShieldCheckIcon

  return (
    <section
      aria-label="Mission Readiness"
      className={cn(
        'rounded-3xl border-2 p-5',
        review ? 'border-status-alert/70 bg-status-alert/10' : monitor ? 'border-status-warn/60 bg-status-warn/10' : 'border-status-ok/50 bg-status-ok/5',
      )}
    >
      <div className="flex gap-4">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', review ? 'bg-status-alert/20 text-status-alert' : monitor ? 'bg-status-warn/20 text-status-warn' : 'bg-status-ok/15 text-status-ok')}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground">MISSION READINESS</p>
          <p className="text-2xl font-semibold">{labels[readiness.status]}</p>
          <p className="text-base text-muted-foreground">{readiness.message}</p>
          <p className="text-sm text-muted-foreground">Assessed locally at {formatClock(readiness.evaluatedAt)}</p>
        </div>
      </div>
      <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl border border-current/15 px-3 text-left text-base font-semibold" aria-expanded={expanded}>
        Why am I seeing this?
        <ChevronDownIcon className={cn('size-5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          {readiness.evidence.map((item) => (
            <p key={item.id} className="rounded-lg bg-background/50 px-3 py-2">
              <span className="font-semibold">{item.label}:</span> {item.value} {item.unit}
              {item.detail && <span className="block break-all text-muted-foreground">Source: {item.detail}</span>}
            </p>
          ))}
          <p className="text-muted-foreground">{readiness.disclaimer}</p>
        </div>
      )}
    </section>
  )
}
