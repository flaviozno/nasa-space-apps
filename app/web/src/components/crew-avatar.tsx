import { initialsOf } from '@/lib/initials'
import { cn } from '@/lib/utils'

/** Round avatar with the member's initials. Example: `<CrewAvatar name="Ana Ribeiro" />` */
export function CrewAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ring-2 ring-primary/30',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
