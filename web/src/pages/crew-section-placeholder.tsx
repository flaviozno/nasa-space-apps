import { HourglassIcon } from 'lucide-react'

/** Temporary content for Crew Hub sections not built yet (check-in, weekly, manual). */
export function CrewSectionPlaceholder({ title }: { title: string }) {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
      <HourglassIcon className="size-10 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">Coming in the next step.</p>
    </section>
  )
}
