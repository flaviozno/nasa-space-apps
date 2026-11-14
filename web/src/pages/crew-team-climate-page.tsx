import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { QuestionnaireClosed } from '@/components/questionnaire-closed'
import { QuestionnaireSaved } from '@/components/questionnaire-saved'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { ScalePicker } from '@/components/scale-picker'
import { useNow } from '@/hooks/use-now'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import { ApiError } from '@/lib/onboard-api'
import { onboardKeys, useQuestionnaireStatus, useSubmitTeamClimate } from '@/lib/onboard-queries'
import { isAvailable } from '@/lib/questionnaire-status'
import { bigButton } from '@/lib/touch-styles'
import { cn } from '@/lib/utils'
import { TEAM_CLIMATE_QUESTION } from '@/lib/weekly-questionnaires'

/** `/crew/:crewId/weekly/team-climate` — one 1–10 question, then save. */
export function CrewTeamClimatePage() {
  const member = useCrewHubMember()
  const status = useQuestionnaireStatus(member.crewId)
  const submit = useSubmitTeamClimate(member.crewId)
  const queryClient = useQueryClient()
  const now = useNow()
  const [score, setScore] = useState<number | undefined>(undefined)
  const weeklyPath = `/crew/${member.crewId}/weekly`

  const save = () => {
    if (score === undefined) return
    submit.mutate(
      { score },
      {
        onSuccess: () => toast.success('Team climate saved'),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            queryClient.invalidateQueries({ queryKey: onboardKeys.questionnaireStatus(member.crewId) })
          }
        },
      },
    )
  }

  const back = (
    <Link to={weeklyPath} className={cn(bigButton, 'bg-primary text-primary-foreground')}>
      Back to weekly
    </Link>
  )

  if (submit.isSuccess) {
    return <QuestionnaireSaved title="Thank you" message={<p>Team climate {submit.data.total ?? score} of 10 saved.</p>}>{back}</QuestionnaireSaved>
  }
  if (status.isPending) return <LoadingBlock className="h-80 rounded-3xl" />
  if (status.isError) {
    return <QueryError error={status.error} title="Could not check this questionnaire" onRetry={() => status.refetch()} />
  }
  if (!isAvailable(status.data.teamClimate, now)) {
    return (
      <QuestionnaireClosed title="Team climate done" window={status.data.teamClimate} now={now}>
        {back}
      </QuestionnaireClosed>
    )
  }

  return (
    <section aria-label="Team climate" className="flex flex-col gap-8 rounded-3xl border bg-card p-6 md:p-8">
      <h2 className="text-2xl font-semibold">Team climate</h2>
      <h3 className="text-4xl font-semibold">{TEAM_CLIMATE_QUESTION.title}</h3>
      <ScalePicker
        label={TEAM_CLIMATE_QUESTION.title}
        min={TEAM_CLIMATE_QUESTION.min}
        max={TEAM_CLIMATE_QUESTION.max}
        lowLabel={TEAM_CLIMATE_QUESTION.lowLabel}
        highLabel={TEAM_CLIMATE_QUESTION.highLabel}
        value={score}
        onChange={setScore}
      />
      {submit.isError && <QueryError error={submit.error} title="Could not save team climate" onRetry={save} />}
      <footer className="flex items-center justify-between gap-3 border-t pt-5">
        <Link to={weeklyPath} className={cn(bigButton, 'border-2 bg-card active:bg-accent')}>
          Cancel
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={score === undefined || submit.isPending}
          className={cn(bigButton, 'min-w-56 bg-primary text-primary-foreground')}
        >
          {submit.isPending ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </section>
  )
}
