import { CalendarCheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCountdown, formatGmtClock, formatReopening, type QuestionnaireWindow } from '@/lib/questionnaire-status'

interface QuestionnaireClosedProps {
  title: string
  window: QuestionnaireWindow
  now: number
  /** Big action buttons under the text, e.g. "Back to overview". */
  children?: ReactNode
}

/** Shown instead of a questionnaire that was already answered in its current window. */
export function QuestionnaireClosed({ title, window, now, children }: QuestionnaireClosedProps) {
  return (
    <section className="flex min-h-96 flex-col items-center justify-center gap-5 rounded-3xl border bg-card p-8 text-center">
      <CalendarCheckIcon className="size-20 text-status-ok" aria-hidden="true" />
      <h2 className="text-4xl font-semibold">{title}</h2>
      <p className="max-w-2xl text-xl text-muted-foreground">
        {window.lastSubmittedAt !== null && <>Submitted at {formatGmtClock(window.lastSubmittedAt)}. </>}
        {window.availableAgainAt !== null && (
          <>
            It opens again {formatReopening(window.availableAgainAt, now)} — in {formatCountdown(window.availableAgainAt, now)}.
          </>
        )}
      </p>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </section>
  )
}
