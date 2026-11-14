import { KeyboardIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { parseTypedValue, stepValue, type ManualMetric } from '@/lib/manual-measurements'

interface ValueStepperProps {
  definition: ManualMetric
  value: number
  onChange: (value: number) => void
}

const stepButton =
  'flex h-16 flex-col items-center justify-center rounded-2xl border-2 bg-background text-lg font-semibold tabular-nums transition-colors active:bg-accent disabled:opacity-30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60'

/**
 * A value with large − / + buttons under it, in a fine and a coarse step (e.g. ±0.1 and ±1 kg).
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
      {/* Row 1: the value. The whole box is the touch target for typing. */}
      {draft === null ? (
        <button
          type="button"
          onClick={startTyping}
          aria-label={`Type ${definition.label}`}
          className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/60 px-4 transition-colors active:border-primary active:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <span className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-5xl font-semibold tabular-nums">{value.toFixed(definition.decimals)}</span>
            <span className="text-xl text-muted-foreground">{definition.unit}</span>
          </span>
          <span className="flex items-center gap-1.5 text-base font-medium text-primary">
            <KeyboardIcon className="size-7" aria-hidden="true" />
            Type
          </span>
        </button>
      ) : (
        <div className="flex h-20 w-full items-center justify-center gap-2">
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
            className="h-20 w-48 rounded-2xl border-2 border-primary bg-background px-3 text-center text-5xl font-semibold tabular-nums outline-none aria-invalid:border-status-alert"
          />
          <span className="text-xl whitespace-nowrap text-muted-foreground">{definition.unit}</span>
        </div>
      )}

      {/* Row 2: coarse and fine steps down and up. */}
      <div className="grid grid-cols-4 gap-2">
        {button(-coarse)}
        {button(-fine)}
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
