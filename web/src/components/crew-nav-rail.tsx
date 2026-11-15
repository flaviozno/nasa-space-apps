import { CalendarCheckIcon, ClipboardCheckIcon, GaugeIcon, RulerIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
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
    'relative flex min-h-16 min-w-22 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition-colors sm:min-h-18 sm:min-w-24 sm:text-sm',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
    active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground active:bg-accent',
  )

/**
 * Crew Hub sections as big always-visible touch targets, like a car's infotainment rail:
 * a vertical rail on landscape tablets, a horizontal bar on narrow screens.
 */
export function CrewNavRail({ due = {} }: { due?: { checkin?: boolean; weekly?: boolean } }) {
  return (
    <nav
      aria-label="Crew Hub sections"
      className="glass-panel shrink-0 flex gap-1.5 overflow-x-auto rounded-2xl border p-1.5 md:flex-col md:self-stretch"
    >
      {ITEMS.map(({ to, label, icon: Icon, end, dueKey }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn(itemClass(isActive), 'relative')}>
          {({ isActive }) => <>
          {isActive && <motion.span layoutId="crew-nav-active" className="absolute inset-0 -z-10 rounded-xl bg-primary shadow-[0_8px_24px_-12px_var(--primary)]" transition={{ type: 'spring', bounce: 0.16, duration: 0.4 }} />}
          <Icon className="size-5 sm:size-6" aria-hidden="true" />
          {label}
          {dueKey && due[dueKey] && (
            <span className="absolute top-1 right-1 rounded-full bg-status-warn px-1.5 text-[10px] font-bold text-background">
              Due
            </span>
          )}
          </>}
        </NavLink>
      ))}
      <div className="hidden flex-1 md:block" />
      <NavLink to="/" className={itemClass(false)}>
        <UsersIcon className="size-5 sm:size-6" aria-hidden="true" />
        Switch
      </NavLink>
    </nav>
  )
}
