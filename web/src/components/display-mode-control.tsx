import { MonitorIcon, MoonStarIcon, SunMediumIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type DisplayMode = 'dim' | 'auto' | 'high'

const MODES = [
  { value: 'dim', label: 'Dim', Icon: MoonStarIcon },
  { value: 'auto', label: 'Auto', Icon: SunMediumIcon },
  { value: 'high', label: 'High', Icon: MonitorIcon },
] as const

/** A local display profile for changing cabin light. It never depends on a network service. */
export function DisplayModeControl() {
  const [mode, setMode] = useState<DisplayMode>(() => {
    const stored = window.localStorage.getItem('health-hub-display-mode')
    return stored === 'dim' || stored === 'high' || stored === 'auto' ? stored : 'auto'
  })

  useEffect(() => {
    document.documentElement.dataset.displayMode = mode
    window.localStorage.setItem('health-hub-display-mode', mode)
  }, [mode])

  return (
    <div className="flex min-h-12 items-center gap-1 rounded-xl border bg-card p-1" role="group" aria-label="Display brightness">
      {MODES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          className={cn(
            'flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
            mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground active:bg-accent',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="hidden xl:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
