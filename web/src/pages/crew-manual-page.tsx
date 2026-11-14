import { CheckIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { QuestionnaireSaved } from '@/components/questionnaire-saved'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { ValueStepper } from '@/components/value-stepper'
import { useCrewHubMember } from '@/lib/crew-hub-context'
import {
  bloodPressureError,
  MANUAL_METRICS,
  type ManualMetricId,
  MEASUREMENT_GROUPS,
  stepValue,
} from '@/lib/manual-measurements'
import { formatValue, metricDisplay } from '@/lib/metric-catalog'
import { useBaseline, useCrewMetrics, useSubmitManualEntries } from '@/lib/onboard-queries'
import { bigButton } from '@/lib/touch-styles'
import { cn } from '@/lib/utils'

type Values = Partial<Record<ManualMetricId, number>>

/**
 * `/crew/:crewId/manual` — measurements no sensor collects (body mass, blood pressure, water,
 * grip). Each starts at the last recorded value (or the personal baseline) and is adjusted
 * with − / + buttons; only the measurements the astronaut touched or included are sent.
 */
export function CrewManualPage() {
  const member = useCrewHubMember()
  const metrics = useCrewMetrics(member.crewId)
  const baseline = useBaseline(member.crewId)
  const submit = useSubmitManualEntries(member.crewId)
  const [edited, setEdited] = useState<Values>({})
  const [included, setIncluded] = useState<Set<string>>(new Set())

  if (submit.isSuccess) {
    return (
      <QuestionnaireSaved
        title="Measurements saved"
        message={
          <ul className="space-y-1">
            {submit.data.accepted.map((entry) => (
              <li key={entry.id}>
                {metricDisplay(entry.metric).label}: {formatValue(entry.metric, entry.value)} {entry.unit}
              </li>
            ))}
          </ul>
        }
      >
        <Link to={`/crew/${member.crewId}`} className={cn(bigButton, 'bg-primary text-primary-foreground')}>
          Back to overview
        </Link>
        <button type="button" onClick={() => { submit.reset(); setIncluded(new Set()); setEdited({}) }} className={cn(bigButton, 'border-2 bg-card active:bg-accent')}>
          Add more
        </button>
      </QuestionnaireSaved>
    )
  }

  if (metrics.isPending || baseline.isPending) return <LoadingBlock className="h-96 rounded-3xl" />
  if (metrics.isError || baseline.isError) {
    const error = (metrics.error ?? baseline.error)!
    return <QueryError error={error} title="Could not load your last measurements" onRetry={() => { metrics.refetch(); baseline.refetch() }} />
  }

  // Start from the last recorded value; fall back to the personal baseline median.
  const startValue = (id: ManualMetricId): number => {
    const definition = MANUAL_METRICS[id]
    const last = metrics.data.metrics.find((m) => m.metric === id)?.value
    const median = baseline.data.baselines.find((b) => b.metric === id)?.median
    return stepValue(definition, last ?? median ?? definition.min, 0)
  }
  const valueOf = (id: ManualMetricId) => edited[id] ?? startValue(id)

  const toggle = (groupId: string) =>
    setIncluded((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })

  const bpError = included.has('blood_pressure')
    ? bloodPressureError(valueOf('blood_pressure_systolic'), valueOf('blood_pressure_diastolic'))
    : null
  const selectedMetrics = MEASUREMENT_GROUPS.filter((group) => included.has(group.id)).flatMap((group) => group.metrics)

  const save = () => {
    if (selectedMetrics.length === 0 || bpError) return
    submit.mutate(
      { entries: selectedMetrics.map((id) => ({ metric: id, value: valueOf(id) })) },
      { onSuccess: () => toast.success('Measurements saved') },
    )
  }

  return (
    <section aria-label="Manual measurements" className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold">Manual measurements</h2>
        <p className="text-lg text-muted-foreground">
          Values start at your last measurement. Adjust with − / + and tap Include for each one you took.
        </p>
      </div>

      {/* Blood pressure (two values) spans the full width; the single-value cards share a row. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MEASUREMENT_GROUPS.map((group) => {
          const isIncluded = included.has(group.id)
          return (
            <div
              key={group.id}
              role="group"
              aria-label={group.title}
              className={cn(
                'space-y-4 rounded-3xl border-2 bg-card p-5 transition-colors',
                isIncluded ? 'border-primary' : 'border-border',
                group.metrics.length > 1 && 'md:col-span-2 xl:col-span-3',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">{group.title}</h3>
                <button
                  type="button"
                  aria-pressed={isIncluded}
                  onClick={() => toggle(group.id)}
                  className={cn(
                    'flex h-12 items-center gap-2 rounded-xl border-2 px-4 text-lg font-semibold transition-colors',
                    isIncluded ? 'border-primary bg-primary text-primary-foreground' : 'border-border active:bg-accent',
                  )}
                >
                  {isIncluded ? <CheckIcon className="size-5" aria-hidden="true" /> : <PlusIcon className="size-5" aria-hidden="true" />}
                  {isIncluded ? 'Included' : 'Include'}
                </button>
              </div>
              <div className={cn('grid gap-4', group.metrics.length > 1 && 'md:grid-cols-2')}>
                {group.metrics.map((id) => (
                  <div key={id} className="space-y-1">
                    {group.metrics.length > 1 && <p className="text-lg text-muted-foreground">{MANUAL_METRICS[id].label}</p>}
                    <ValueStepper
                      definition={MANUAL_METRICS[id]}
                      value={valueOf(id)}
                      onChange={(value) => {
                        setEdited((current) => ({ ...current, [id]: value }))
                        setIncluded((current) => new Set(current).add(group.id))
                      }}
                    />
                  </div>
                ))}
              </div>
              {group.id === 'blood_pressure' && bpError && (
                <p role="alert" className="text-lg font-semibold text-status-alert">{bpError}</p>
              )}
            </div>
          )
        })}
      </div>

      {submit.isError && <QueryError error={submit.error} title="Could not save the measurements" onRetry={save} />}

      {/* Stays on screen while scrolling the cards, so saving never needs a scroll back down. */}
      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-3xl border bg-card/95 p-3 pl-6 shadow-lg backdrop-blur">
        <span className="text-lg text-muted-foreground">
          {selectedMetrics.length === 0 ? 'Nothing included yet' : `${selectedMetrics.length} included`}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={selectedMetrics.length === 0 || bpError !== null || submit.isPending}
          className={cn(bigButton, 'min-w-72 bg-primary text-primary-foreground')}
        >
          {submit.isPending
            ? 'Saving…'
            : selectedMetrics.length === 0
              ? 'Include a measurement'
              : `Save ${selectedMetrics.length} ${selectedMetrics.length === 1 ? 'value' : 'values'}`}
        </button>
      </div>
    </section>
  )
}
