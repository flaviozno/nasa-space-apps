import { cn } from '@/lib/utils'

const LIMIT = 4

/**
 * Horizontal gauge of the z-score from −4σ to +4σ. The shaded middle is the personal
 * normal range (±2σ); the dot is the current value. Example: `<ZGauge z={1.3} dotClass="bg-status-ok" />`
 */
export function ZGauge({ z, dotClass }: { z: number; dotClass: string }) {
  const clamped = Math.max(-LIMIT, Math.min(LIMIT, z))
  const position = ((clamped + LIMIT) / (2 * LIMIT)) * 100

  return (
    <div aria-hidden="true" className="relative h-2.5 rounded-full bg-muted">
      <div className="absolute inset-y-0 left-1/4 w-1/2 rounded-full bg-primary/20" />
      <div className="absolute inset-y-[-3px] left-1/2 w-px bg-primary/50" />
      <div
        className={cn(
          'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card transition-[left] duration-500',
          dotClass,
        )}
        style={{ left: `${position}%` }}
      />
    </div>
  )
}
