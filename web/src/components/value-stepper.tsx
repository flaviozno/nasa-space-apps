import { MinusIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { parseTypedValue, stepValue, type ManualMetric } from '@/lib/manual-measurements'

interface ValueStepperProps {
  definition: ManualMetric
  value: number
  onChange: (value: number) => void
}

const stepButton =
  'flex h-16 min-w-20 flex-col items-center justify-center rounded-2xl border-2 bg-background text-lg font-semibold tabular-nums transition-colors active:bg-accent disabled:opacity-30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60'

/**
 * Large − / + buttons around a value, with a fine and a coarse step (e.g. ±0.1 and ±1 kg).
 * Tapping the value switches to typing it (numeric keyboard on tablets; comma or dot both work).
 */
export function ValueStepper({ definition, value, onChange }: ValueStepperProps) {
  const [fine, coarse] = definition.steps
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startTyping = () => {
    setError(null)
    setDraft(value.toFixed(definition.decimals))
  }
  const cancelTyping = () => {
    setError(null)
    setDraft(null)
  }
  const commitTyping = () => {
    if (draft === null) return
    const parsed = parseTypedValue(definition, draft)
    if (parsed === null) {
      setError(`Enter a number from ${definition.min} to ${definition.max} ${definition.unit}.`)
      return
    }
    setError(null)
    setDraft(null)
    onChange(parsed)
  }

  const button = (delta: number) => {
    const next = stepValue(definition, value, delta)
    const label = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`
    return (
      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={next === value || draft !== null}
        aria-label={`${definition.label} ${label} ${definition.unit}`}
        className={stepButton}
      >
        {delta > 0 ? <PlusIcon className="size-5" aria-hidden="true" /> : <MinusIcon className="size-5" aria-hidden="true" />}
        <span className="text-sm text-muted-foreground">{Math.abs(delta)}</span>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {button(-coarse)}
        {button(-fine)}
        {draft === null ? (
          <button
            type="button"
            onClick={startTyping}
            aria-label={`Type ${definition.label}`}
            className="group flex min-w-32 flex-1 items-baseline justify-center gap-1.5 rounded-2xl py-2 transition-colors active:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <span className="text-5xl font-semibold tabular-nums">{value.toFixed(definition.decimals)}</span>
            <span className="text-lg text-muted-foreground">{definition.unit}</span>
            <PencilIcon className="size-4 self-center text-muted-foreground" aria-hidden="true" />
          </button>
        ) : (
          <span className="flex min-w-32 flex-1 items-baseline justify-center gap-1.5">
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              aria-label={`${definition.label} in ${definition.unit}`}
              aria-invalid={error !== null}
              value={draft}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitTyping()
                if (event.key === 'Escape') cancelTyping()
              }}
              onBlur={commitTyping}
              className="w-36 rounded-xl border-2 border-primary bg-background px-2 py-1 text-center text-5xl font-semibold tabular-nums outline-none aria-invalid:border-status-alert"
            />
            <span className="text-lg text-muted-foreground">{definition.unit}</span>
          </span>
        )}
        {button(fine)}
        {button(coarse)}
      </div>
      {error && (
        <p role="alert" className="text-center text-lg font-semibold text-status-alert">
          {error}
        </p>
      )}
    </div>
  )
}
