import { CalendarCheckIcon, ClipboardCheckIcon, GaugeIcon, RulerIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

interface RailItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Which `due` flag puts a "Due" badge on this item. */
  dueKey?: 'checkin' | 'weekly'
}

const ITEMS: RailItem[] = [
  { to: '.', label: 'Overview', icon: GaugeIcon, end: true },
  { to: 'checkin', label: 'Check-in', icon: ClipboardCheckIcon, dueKey: 'checkin' },
  { to: 'weekly', label: 'Weekly', icon: CalendarCheckIcon, dueKey: 'weekly' },
  { to: 'manual', label: 'Manual', icon: RulerIcon },
]

const itemClass = (active: boolean) =>
  cn(
    'flex min-h-20 min-w-24 flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-base font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground active:bg-accent',
  )

/**
 * Crew Hub sections as big always-visible touch targets, like a car's infotainment rail:
 * a vertical rail on landscape tablets, a horizontal bar on narrow screens.
 */
export function CrewNavRail({ due = {} }: { due?: { checkin?: boolean; weekly?: boolean } }) {
  return (
    <nav
      aria-label="Crew Hub sections"
      className="flex gap-2 overflow-x-auto rounded-3xl border bg-card p-2 md:sticky md:top-4 md:flex-col md:self-start"
    >
      {ITEMS.map(({ to, label, icon: Icon, end, dueKey }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn(itemClass(isActive), 'relative')}>
          <Icon className="size-8" aria-hidden="true" />
          {label}
          {dueKey && due[dueKey] && (
            <span className="absolute top-1.5 right-1.5 rounded-full bg-status-warn px-1.5 text-xs font-bold text-background">
              Due
            </span>
          )}
        </NavLink>
      ))}
      <div className="hidden flex-1 md:block" />
      <NavLink to="/" className={itemClass(false)}>
        <UsersIcon className="size-8" aria-hidden="true" />
        Switch
      </NavLink>
    </nav>
  )
}
