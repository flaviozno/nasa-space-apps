import { cn } from '@/lib/utils'

interface OptionPickerProps<T extends number> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
}

/** Stacked full-width touch buttons for worded answers (e.g. PHQ-4), exposed as a radio group. */
export function OptionPicker<T extends number>({ label, options, value, onChange }: OptionPickerProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const checked = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-h-20 items-center gap-4 rounded-2xl border-2 px-5 text-left text-2xl font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
              checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card active:bg-accent',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-lg tabular-nums',
                checked ? 'border-primary-foreground/60' : 'border-border text-muted-foreground',
              )}
            >
              {option.value}
            </span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
