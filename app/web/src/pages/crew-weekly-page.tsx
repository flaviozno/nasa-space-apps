import { ChevronRightIcon, HeartHandshakeIcon, UsersRoundIcon, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { useNow } from '@/hooks/use-now'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import { useQuestionnaireStatus } from '@/lib/onboard-queries'
import { formatReopening, isAvailable, type QuestionnaireWindow } from '@/lib/questionnaire-status'
import { cn } from '@/lib/utils'

/** `/crew/:crewId/weekly` — the two weekly questionnaires and whether each is due. */
export function CrewWeeklyPage() {
  const member = useCrewHubMember()
  const status = useQuestionnaireStatus(member.crewId)
  const now = useNow()

  if (status.isPending) return <LoadingBlock className="h-72 rounded-3xl" />
  if (status.isError) {
    return <QueryError error={status.error} title="Could not load the weekly questionnaires" onRetry={() => status.refetch()} />
  }

  return (
    <section aria-label="Weekly questionnaires" className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold">Weekly questionnaires</h2>
        <p className="text-lg text-muted-foreground">Once a week each. Your answers stay onboard first and reach Earth when the link allows.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <WeeklyCard
          to="phq4"
          icon={HeartHandshakeIcon}
          title="Wellbeing (PHQ-4)"
          detail="4 short questions · about 1 minute"
          window={status.data.phq4}
          now={now}
        />
        <WeeklyCard
          to="team-climate"
          icon={UsersRoundIcon}
          title="Team climate"
          detail="1 question · a few seconds"
          window={status.data.teamClimate}
          now={now}
        />
      </div>
    </section>
  )
}

interface WeeklyCardProps {
  to: string
  icon: LucideIcon
  title: string
  detail: string
  window: QuestionnaireWindow
  now: number
}

function WeeklyCard({ to, icon: Icon, title, detail, window, now }: WeeklyCardProps) {
  const due = isAvailable(window, now)
  return (
    <Link
      to={to}
      className={cn(
        'group flex min-h-44 items-center gap-6 rounded-3xl border-2 bg-card px-7 py-6 transition-colors active:bg-accent',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
        due ? 'border-status-warn/60' : 'border-border',
      )}
    >
      <span className={cn('flex size-16 shrink-0 items-center justify-center rounded-2xl', due ? 'bg-status-warn/15 text-status-warn' : 'bg-status-ok/15 text-status-ok')}>
        <Icon className="size-9" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-2xl font-semibold">{title}</span>
        <span className="block text-lg text-muted-foreground">{detail}</span>
        <span className={cn('block text-lg font-semibold', due ? 'text-status-warn' : 'text-status-ok')}>
          {due ? 'Due now' : `Done · opens again ${window.availableAgainAt ? formatReopening(window.availableAgainAt, now) : ''}`}
        </span>
      </span>
      <ChevronRightIcon className="size-9 text-muted-foreground transition-transform group-active:translate-x-1" aria-hidden="true" />
    </Link>
  )
}
