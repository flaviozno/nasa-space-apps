import { ChevronRightIcon, ClipboardCheckIcon, PauseCircleIcon, RefreshCwIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { ActionPlan, ActionStep } from '@/lib/onboard-types'
import { formatClock } from '@/lib/time'
import { cn } from '@/lib/utils'

const priorityLabels = {
  ACT_NOW: 'ACT NOW',
  RECHECK: 'RECHECK',
  ROUTINE: 'ROUTINE',
} as const

const actionIcons = {
  PAUSE_TASK: PauseCircleIcon,
  VERIFY_MEASUREMENT: RefreshCwIcon,
  COMPLETE_CHECKIN: ClipboardCheckIcon,
  FOLLOW_APPROVED_PROTOCOL: TriangleAlertIcon,
  CONTINUE_ROUTINE: ShieldCheckIcon,
} as const

/**
 * The astronaut-facing "act" layer: a local, bounded next-step plan rather
 * than a diagnosis. It intentionally works even when the Earth link is down.
 */
export function ActionPlanCard({ crewId, plan }: { crewId: string; plan: ActionPlan }) {
  const actNow = plan.priority === 'ACT_NOW'
  const recheck = plan.priority === 'RECHECK'
  const StatusIcon = actNow || recheck ? TriangleAlertIcon : ShieldCheckIcon

  return (
    <section
      aria-label="What to do now"
      className={cn(
        'overflow-hidden rounded-3xl border-2',
        actNow ? 'border-status-alert/70 bg-status-alert/10' : recheck ? 'border-status-warn/60 bg-status-warn/10' : 'border-status-ok/50 bg-status-ok/5',
      )}
    >
      <header className="flex gap-4 border-b border-current/10 px-5 py-5 sm:px-6">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-2xl',
            actNow ? 'bg-status-alert/20 text-status-alert' : recheck ? 'bg-status-warn/20 text-status-warn' : 'bg-status-ok/15 text-status-ok',
          )}
        >
          <StatusIcon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-bold tracking-[0.18em] text-primary">WHAT TO DO NOW · {priorityLabels[plan.priority]} · LOCAL PLAN</p>
          <h2 className="text-2xl font-semibold tracking-tight">{plan.title}</h2>
          <p className="text-base text-muted-foreground">{plan.detail}</p>
          <p className="text-sm text-muted-foreground">Built from onboard data at {formatClock(plan.evaluatedAt)} · works without Earth link</p>
        </div>
      </header>

      <ol className="divide-y divide-current/10">
        {plan.steps.map((step, index) => (
          <ActionStep key={step.id} crewId={crewId} index={index + 1} step={step} />
        ))}
      </ol>
      <p className="border-t border-current/10 px-5 py-3 text-sm text-muted-foreground sm:px-6">{plan.disclaimer}</p>
    </section>
  )
}

function ActionStep({ crewId, index, step }: { crewId: string; index: number; step: ActionStep }) {
  const Icon = actionIcons[step.actionType]
  const checkin = step.actionType === 'COMPLETE_CHECKIN'

  return (
    <li className="flex gap-4 px-5 py-4 sm:px-6">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/70 font-mono text-sm font-semibold tabular-nums">{index}</span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/55 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="text-base leading-snug text-muted-foreground">{step.detail}</p>
        {checkin && (
          <Link
            to={`/crew/${encodeURIComponent(crewId)}/checkin`}
            className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl border border-primary/40 bg-background/65 px-3 text-base font-semibold text-primary transition-colors active:bg-accent"
          >
            Open health check-in
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  )
}
