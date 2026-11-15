import { CheckCircle2Icon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Confirmation after a questionnaire is saved; `children` holds the action buttons. */
export function QuestionnaireSaved({ title, message, children }: { title: string; message: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex min-h-96 flex-col items-center justify-center gap-5 rounded-3xl border bg-card p-8 text-center">
      <CheckCircle2Icon className="size-20 text-status-ok" aria-hidden="true" />
      <h2 className="text-4xl font-semibold">{title}</h2>
      <div className="max-w-2xl space-y-2 text-xl text-muted-foreground">{message}</div>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </section>
  )
}
