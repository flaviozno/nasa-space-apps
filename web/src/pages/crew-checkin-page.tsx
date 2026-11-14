import { useQueryClient } from '@tanstack/react-query'
import { CalendarCheckIcon, CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, PencilIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { ScalePicker } from '@/components/scale-picker'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import {
  type CheckinAnswers,
  FEELING_QUESTIONS,
  INITIAL_ANSWERS,
  SYMPTOM_QUESTIONS,
  toCheckinPayload,
} from '@/lib/daily-checkin'
import { useNow } from '@/hooks/use-now'
import { ApiError } from '@/lib/onboard-api'
import { onboardKeys, useQuestionnaireStatus, useSubmitDailyCheckin } from '@/lib/onboard-queries'
import { formatCountdown, formatGmtClock, isAvailable } from '@/lib/questionnaire-status'
import { formatClock } from '@/lib/time'
import { cn } from '@/lib/utils'

const SYMPTOMS_STEP = FEELING_QUESTIONS.length
const REVIEW_STEP = SYMPTOMS_STEP + 1
const STEP_COUNT = REVIEW_STEP + 1
const ADVANCE_DELAY_MS = 250

const bigButton =
  'inline-flex h-16 items-center justify-center gap-2 rounded-2xl px-8 text-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-40'

/**
 * `/crew/:crewId/checkin` — daily check-in, one question per screen like a car display:
 * tap a number and it moves on. Symptoms share one screen; a review screen sends it.
 * Once a day: after a check-in it stays closed until 00:00 GMT (the ISS's official time).
 */
export function CrewCheckinPage() {
  const member = useCrewHubMember()
  const submit = useSubmitDailyCheckin(member.crewId)
  const status = useQuestionnaireStatus(member.crewId)
  const queryClient = useQueryClient()
  const now = useNow()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<CheckinAnswers>(INITIAL_ANSWERS)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const answer = (key: keyof CheckinAnswers, value: number) => setAnswers((current) => ({ ...current, [key]: value }))
  const goTo = (next: number) => {
    clearTimeout(advanceTimer.current)
    setStep(Math.max(0, Math.min(REVIEW_STEP, next)))
  }

  const save = () => {
    const payload = toCheckinPayload(answers)
    if (!payload) return
    submit.mutate(payload, {
      onSuccess: () => toast.success('Check-in saved'),
      // 409: someone already checked in today (another tablet, a retry) — show the closed state.
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          queryClient.invalidateQueries({ queryKey: onboardKeys.questionnaireStatus(member.crewId) })
        }
      },
    })
  }

  if (submit.isSuccess) {
    return (
      <section className="flex min-h-96 flex-col items-center justify-center gap-5 rounded-3xl border bg-card p-8 text-center">
        <CheckCircle2Icon className="size-20 text-status-ok" aria-hidden="true" />
        <h2 className="text-4xl font-semibold">Check-in saved</h2>
        <p className="text-xl text-muted-foreground">
          {submit.data.observationsCreated} answers recorded at {formatClock(submit.data.submittedAt)}. They are stored
          onboard first and reach Earth when the link allows.
        </p>
        <Link to={`/crew/${member.crewId}`} className={cn(bigButton, 'bg-primary text-primary-foreground')}>
          Back to overview
        </Link>
      </section>
    )
  }

  if (status.isPending) return <LoadingBlock className="h-96 rounded-3xl" />
  if (status.isError) {
    return <QueryError error={status.error} title="Could not check today's check-in" onRetry={() => status.refetch()} />
  }

  const daily = status.data.dailyCheckin
  if (!isAvailable(daily, now)) {
    return (
      <section className="flex min-h-96 flex-col items-center justify-center gap-5 rounded-3xl border bg-card p-8 text-center">
        <CalendarCheckIcon className="size-20 text-status-ok" aria-hidden="true" />
        <h2 className="text-4xl font-semibold">Check-in done for today</h2>
        <p className="max-w-2xl text-xl text-muted-foreground">
          {daily.lastSubmittedAt !== null && <>Submitted at {formatGmtClock(daily.lastSubmittedAt)}. </>}
          The next check-in opens at {formatGmtClock(daily.availableAgainAt!)} — in{' '}
          {formatCountdown(daily.availableAgainAt!, now)}.
        </p>
        <Link to={`/crew/${member.crewId}`} className={cn(bigButton, 'bg-primary text-primary-foreground')}>
          Back to overview
        </Link>
      </section>
    )
  }

  const feeling = FEELING_QUESTIONS[step]
  const canGoNext = feeling ? answers[feeling.key] !== undefined : step === SYMPTOMS_STEP

  return (
    <section aria-label="Daily check-in" className="flex flex-col gap-6 rounded-3xl border bg-card p-6 md:p-8">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold">Daily check-in</h2>
          <span className="text-lg text-muted-foreground">
            Step {step + 1} of {STEP_COUNT}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Check-in progress"
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step + 1}
          className="flex gap-1.5"
        >
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span
              key={index}
              className={cn('h-2 flex-1 rounded-full transition-colors', index <= step ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      </header>

      {feeling && (
        <div key={feeling.key} className="flex flex-col gap-8 py-4 animate-in fade-in slide-in-from-right-4">
          <h3 className="text-4xl font-semibold">{feeling.title}</h3>
          <ScalePicker
            label={feeling.title}
            min={feeling.min}
            max={feeling.max}
            lowLabel={feeling.lowLabel}
            highLabel={feeling.highLabel}
            value={answers[feeling.key]}
            onChange={(value) => {
              answer(feeling.key, value)
              clearTimeout(advanceTimer.current)
              advanceTimer.current = setTimeout(() => setStep((current) => current + 1), ADVANCE_DELAY_MS)
            }}
          />
        </div>
      )}

      {step === SYMPTOMS_STEP && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
          <div className="space-y-1">
            <h3 className="text-4xl font-semibold">Any symptoms today?</h3>
            <p className="text-lg text-muted-foreground">0 means none. Only change what bothers you.</p>
          </div>
          <div className="grid gap-x-8 gap-y-5 xl:grid-cols-2">
            {SYMPTOM_QUESTIONS.map((symptom) => (
              <div key={symptom.key} className="space-y-2">
                <p className="text-xl font-medium">{symptom.title}</p>
                <ScalePicker
                  label={symptom.title}
                  min={symptom.min}
                  max={symptom.max}
                  value={answers[symptom.key]}
                  onChange={(value) => answer(symptom.key, value)}
                  size="compact"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === REVIEW_STEP && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
          <h3 className="text-4xl font-semibold">Review and save</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...FEELING_QUESTIONS, ...SYMPTOM_QUESTIONS].map((question, index) => (
              <li key={question.key}>
                <button
                  type="button"
                  onClick={() => goTo(index < SYMPTOMS_STEP ? index : SYMPTOMS_STEP)}
                  aria-label={`Edit ${question.title}`}
                  className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 bg-background px-5 py-3 text-left active:bg-accent"
                >
                  <span className="text-lg text-muted-foreground">{question.title}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-3xl font-semibold tabular-nums">{answers[question.key] ?? '—'}</span>
                    <PencilIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {submit.isError && <QueryError error={submit.error} title="Could not save the check-in" onRetry={save} />}
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t pt-5">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className={cn(bigButton, 'border-2 bg-card active:bg-accent')}
        >
          <ChevronLeftIcon className="size-6" aria-hidden="true" />
          Back
        </button>
        {step < REVIEW_STEP ? (
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            disabled={!canGoNext}
            className={cn(bigButton, 'bg-primary text-primary-foreground')}
          >
            {step === SYMPTOMS_STEP ? 'Review' : 'Next'}
            <ChevronRightIcon className="size-6" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={submit.isPending || toCheckinPayload(answers) === null}
            className={cn(bigButton, 'min-w-56 bg-primary text-primary-foreground')}
          >
            {submit.isPending ? 'Saving…' : 'Save check-in'}
          </button>
        )}
      </footer>
    </section>
  )
}
