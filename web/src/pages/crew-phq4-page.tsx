import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { OptionPicker } from '@/components/option-picker'
import { QuestionnaireClosed } from '@/components/questionnaire-closed'
import { QuestionnaireSaved } from '@/components/questionnaire-saved'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { useNow } from '@/hooks/use-now'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import { ApiError } from '@/lib/onboard-api'
import { onboardKeys, useQuestionnaireStatus, useSubmitPhq4 } from '@/lib/onboard-queries'
import { isAvailable } from '@/lib/questionnaire-status'
import { bigButton } from '@/lib/touch-styles'
import { cn } from '@/lib/utils'
import { PHQ4_OPTIONS, PHQ4_PROMPT, PHQ4_QUESTIONS, phq4OptionLabel } from '@/lib/weekly-questionnaires'

const REVIEW_STEP = PHQ4_QUESTIONS.length
const STEP_COUNT = REVIEW_STEP + 1
const ADVANCE_DELAY_MS = 250

/** `/crew/:crewId/weekly/phq4` — PHQ-4, one question per screen, then review and save. */
export function CrewPhq4Page() {
  const member = useCrewHubMember()
  const status = useQuestionnaireStatus(member.crewId)
  const submit = useSubmitPhq4(member.crewId)
  const queryClient = useQueryClient()
  const now = useNow()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => PHQ4_QUESTIONS.map(() => undefined))
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const weeklyPath = `/crew/${member.crewId}/weekly`
  const goTo = (next: number) => {
    clearTimeout(advanceTimer.current)
    setStep(Math.max(0, Math.min(REVIEW_STEP, next)))
  }
  const complete = answers.every((answer) => answer !== undefined)

  const save = () => {
    if (!complete) return
    submit.mutate(
      { answers: answers as number[] },
      {
        onSuccess: () => toast.success('Wellbeing questionnaire saved'),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            queryClient.invalidateQueries({ queryKey: onboardKeys.questionnaireStatus(member.crewId) })
          }
        },
      },
    )
  }

  if (submit.isSuccess) {
    return (
      <QuestionnaireSaved
        title="Thank you"
        message={
          <>
            <p>Your answers were saved.</p>
            <p>If something is weighing on you, talk to your crew medical officer — you don't have to wait for next week.</p>
          </>
        }
      >
        <Link to={weeklyPath} className={cn(bigButton, 'bg-primary text-primary-foreground')}>
          Back to weekly
        </Link>
      </QuestionnaireSaved>
    )
  }

  if (status.isPending) return <LoadingBlock className="h-96 rounded-3xl" />
  if (status.isError) {
    return <QueryError error={status.error} title="Could not check this questionnaire" onRetry={() => status.refetch()} />
  }
  if (!isAvailable(status.data.phq4, now)) {
    return (
      <QuestionnaireClosed title="Wellbeing questionnaire done" window={status.data.phq4} now={now}>
        <Link to={weeklyPath} className={cn(bigButton, 'bg-primary text-primary-foreground')}>
          Back to weekly
        </Link>
      </QuestionnaireClosed>
    )
  }

  const question = PHQ4_QUESTIONS[step]

  return (
    <section aria-label="Wellbeing questionnaire" className="flex flex-col gap-6 rounded-3xl border bg-card p-6 md:p-8">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold">Wellbeing (PHQ-4)</h2>
          <span className="text-lg text-muted-foreground">
            Step {step + 1} of {STEP_COUNT}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span key={index} className={cn('h-2 flex-1 rounded-full transition-colors', index <= step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      </header>

      {question !== undefined && (
        <div key={step} className="flex flex-col gap-6 py-2 animate-in fade-in slide-in-from-right-4">
          <p className="text-xl text-muted-foreground">{PHQ4_PROMPT}</p>
          <h3 className="text-4xl font-semibold">{question}</h3>
          <OptionPicker
            label={question}
            options={PHQ4_OPTIONS}
            value={answers[step] as 0 | 1 | 2 | 3 | undefined}
            onChange={(value) => {
              setAnswers((current) => current.map((answer, index) => (index === step ? value : answer)))
              clearTimeout(advanceTimer.current)
              advanceTimer.current = setTimeout(() => setStep((current) => current + 1), ADVANCE_DELAY_MS)
            }}
          />
        </div>
      )}

      {step === REVIEW_STEP && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
          <h3 className="text-4xl font-semibold">Review and save</h3>
          <ul className="grid gap-3">
            {PHQ4_QUESTIONS.map((text, index) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Edit ${text}`}
                  className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border-2 bg-background px-5 py-3 text-left active:bg-accent"
                >
                  <span className="text-lg text-muted-foreground">{text}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xl font-semibold">
                    {phq4OptionLabel(answers[index])}
                    <PencilIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {submit.isError && <QueryError error={submit.error} title="Could not save the questionnaire" onRetry={save} />}
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t pt-5">
        <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0} className={cn(bigButton, 'border-2 bg-card active:bg-accent')}>
          <ChevronLeftIcon className="size-6" aria-hidden="true" />
          Back
        </button>
        {step < REVIEW_STEP ? (
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            disabled={answers[step] === undefined}
            className={cn(bigButton, 'bg-primary text-primary-foreground')}
          >
            Next
            <ChevronRightIcon className="size-6" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={submit.isPending || !complete}
            className={cn(bigButton, 'min-w-56 bg-primary text-primary-foreground')}
          >
            {submit.isPending ? 'Saving…' : 'Save answers'}
          </button>
        )}
      </footer>
    </section>
  )
}
