import { cn } from '@/lib/utils'

interface ScalePickerProps {
  label: string
  min: number
  max: number
  value: number | undefined
  onChange: (value: number) => void
  lowLabel?: string
  highLabel?: string
  size?: 'large' | 'compact'
}

/**
 * Row of numbered touch buttons for a 0–10 / 1–10 scale — one tap picks a value, no keyboard.
 * Exposed as a radio group, so screen readers announce "Mood, 7 of 10, checked".
 */
export function ScalePicker({ label, min, max, value, onChange, lowLabel, highLabel, size = 'large' }: ScalePickerProps) {
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index)
  const large = size === 'large'

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const checked = value === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${option}`}
              onClick={() => onChange(option)}
              className={cn(
                'flex items-center justify-center rounded-xl border-2 font-semibold tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
                large ? 'h-24 text-3xl' : 'h-14 text-xl',
                checked
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground active:bg-accent',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className={cn('flex justify-between text-muted-foreground', large ? 'text-lg' : 'text-sm')}>
          <span>
            {min} · {lowLabel}
          </span>
          <span>
            {highLabel} · {max}
          </span>
        </div>
      )}
    </div>
  )
}
