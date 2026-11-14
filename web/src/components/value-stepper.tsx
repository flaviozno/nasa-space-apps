import { MinusIcon, PlusIcon } from 'lucide-react'
import { stepValue, type ManualMetric } from '@/lib/manual-measurements'
import { cn } from '@/lib/utils'

interface ValueStepperProps {
  definition: ManualMetric
  value: number
  onChange: (value: number) => void
}

const stepButton =
  'flex h-16 min-w-20 flex-col items-center justify-center rounded-2xl border-2 bg-background text-lg font-semibold tabular-nums transition-colors active:bg-accent disabled:opacity-30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60'

/**
 * Large − / + buttons around a value, with a fine and a coarse step (e.g. ±0.1 and ±1 kg),
 * so a measurement is entered by tapping instead of typing.
 */
export function ValueStepper({ definition, value, onChange }: ValueStepperProps) {
  const [fine, coarse] = definition.steps
  const button = (delta: number) => {
    const next = stepValue(definition, value, delta)
    const label = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`
    return (
      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={next === value}
        aria-label={`${definition.label} ${label} ${definition.unit}`}
        className={stepButton}
      >
        {delta > 0 ? <PlusIcon className="size-5" aria-hidden="true" /> : <MinusIcon className="size-5" aria-hidden="true" />}
        <span className="text-sm text-muted-foreground">{Math.abs(delta)}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {button(-coarse)}
      {button(-fine)}
      <output
        aria-label={definition.label}
        className={cn('flex min-w-32 flex-1 items-baseline justify-center gap-1.5 text-center')}
      >
        <span className="text-5xl font-semibold tabular-nums">{value.toFixed(definition.decimals)}</span>
        <span className="text-lg text-muted-foreground">{definition.unit}</span>
      </output>
      {button(fine)}
      {button(coarse)}
    </div>
  )
}
