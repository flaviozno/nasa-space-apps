import { ActivityIcon, EarthIcon, UsersRoundIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { DisplayModeControl } from '@/components/display-mode-control'
import { ServiceStatus } from '@/components/service-status'
import { EARTH_API, ONBOARD_API } from '@/lib/api'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors sm:px-4',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground active:bg-white/5',
  )

function PrimaryNav() {
  return (
    <nav aria-label="Primary navigation" className="flex items-center rounded-full border border-white/8 bg-black/15 p-1 backdrop-blur-md">
      <NavLink to="/" end className={navClass}>
        {({ isActive }) => <><UsersRoundIcon className="size-4" aria-hidden="true" />Crew{isActive && <motion.span layoutId="active-nav" className="absolute inset-0 -z-10 rounded-full bg-white/10" transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} />}</>}
      </NavLink>
      <NavLink to="/earth" className={navClass}>
        {({ isActive }) => <><EarthIcon className="size-4" aria-hidden="true" />Earth{isActive && <motion.span layoutId="active-nav" className="absolute inset-0 -z-10 rounded-full bg-white/10" transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} />}</>}
      </NavLink>
    </nav>
  )
}

/** Shared mobile-first shell: compact mission control bar, deliberate whitespace, and soft page motion. */
export function AppLayout() {
  const location = useLocation()
  const isCrewHub = location.pathname.startsWith('/crew/')
  // Keep the Crew Hub shell mounted while its nested section changes. Keying
  // the complete pathname would remount the member header on Overview →
  // Check-in → Weekly navigation, defeating React Query's cached state.
  const pageKey = location.pathname.startsWith('/crew/')
    ? location.pathname.split('/').slice(0, 3).join('/')
    : location.pathname

  return (
    <div className={cn('app-shell overflow-x-clip bg-background text-foreground', isCrewHub ? 'flex h-svh flex-col overflow-y-hidden' : 'min-h-svh')}>
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/7 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Link to="/" className="group flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
            <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/12 text-primary shadow-[0_0_28px_-8px_var(--primary)]">
              <span className="absolute inset-1 rounded-xl border border-primary/20" />
              <ActivityIcon className="relative size-5" aria-hidden="true" />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-[10px] font-bold tracking-[0.22em] text-primary/80">ORBITAL HEALTH</span>
              <span className="block truncate text-base font-semibold tracking-tight">Mission Hub</span>
            </span>
          </Link>

          <div className="ml-auto sm:ml-2"><PrimaryNav /></div>

          <div className="hidden items-center gap-2 lg:flex">
            <ServiceStatus label="Onboard" baseUrl={ONBOARD_API} />
            <ServiceStatus label="Earth" baseUrl={EARTH_API} />
          </div>
          <div className="hidden sm:block"><DisplayModeControl /></div>
        </div>
      </header>
      <motion.main
        key={pageKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={cn(
          'relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10',
          isCrewHub && 'flex min-h-0 flex-1 flex-col overflow-hidden',
        )}
      >
        <Outlet />
      </motion.main>
    </div>
  )
}
