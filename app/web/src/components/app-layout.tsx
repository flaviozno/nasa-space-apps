import { EarthIcon, RadiationIcon, UsersRoundIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, Outlet, useLocation } from 'react-router'
import { DisplayModeControl } from '@/components/display-mode-control'
import { ServiceStatus } from '@/components/service-status'
import { EARTH_API, ONBOARD_API } from '@/lib/api'
import { cn } from '@/lib/utils'

const REPOSITORY_URL = 'https://github.com/flaviozno/nasa-space-apps/tree/main'

const navClass =(isActive: boolean) =>
  cn(
    'relative flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors sm:px-4',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground active:bg-white/5',
  )

function PrimaryNav() {
  const location = useLocation()
  // A selected astronaut is still in the Crew area. NavLink's exact match
  // would only mark `/`, so the selected state vanished after profile choice.
  const crewActive = location.pathname === '/' || location.pathname.startsWith('/crew/')
  const earthActive = location.pathname === '/earth' || location.pathname.startsWith('/earth/')
  const radiationActive = location.pathname === '/radiation'

  return (
    <nav aria-label="Primary navigation" className="isolate flex items-center rounded-full border border-white/8 bg-black/15 p-1 backdrop-blur-md">
      <Link to="/" aria-current={crewActive ? 'page' : undefined} className={navClass(crewActive)}>
        <UsersRoundIcon className="size-4" aria-hidden="true" />
        Crew
        {crewActive && <motion.span layoutId="active-nav" className="absolute inset-0 -z-10 rounded-full bg-white/10 shadow-sm" transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} />}
      </Link>
      <Link to="/earth" aria-current={earthActive ? 'page' : undefined} className={navClass(earthActive)}>
        <EarthIcon className="size-4" aria-hidden="true" />
        Earth
        {earthActive && <motion.span layoutId="active-nav" className="absolute inset-0 -z-10 rounded-full bg-white/10 shadow-sm" transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} />}
      </Link>
      <Link to="/radiation" aria-current={radiationActive ? 'page' : undefined} className={navClass(radiationActive)}>
        <RadiationIcon className="size-4" aria-hidden="true" />
        Radiation
        {radiationActive && <motion.span layoutId="active-nav" className="absolute inset-0 -z-10 rounded-full bg-white/10 shadow-sm" transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} />}
      </Link>
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
    <div className={cn('app-shell overflow-x-clip bg-background text-foreground', isCrewHub ? 'flex h-svh flex-col overflow-y-hidden' : 'flex min-h-svh flex-col')}>
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/7 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Link to="/" aria-label="CORA home" className="group flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
            <img src="/cora-mark.svg" alt="" className="size-10 shrink-0 sm:hidden" aria-hidden="true" />
            <span className="hidden min-w-0 sm:block">
              <img src="/cora-logo.svg" alt="CORA" className="h-8 w-auto" />
              <span className="mt-0.5 block text-[9px] font-bold tracking-[0.2em] text-primary/75">CREW OPERATIONS READINESS</span>
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
          // flex-1 keeps the footer at the bottom of short pages.
          isCrewHub ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex-1',
        )}
      >
        <Outlet />
      </motion.main>
      <footer className="shrink-0 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl justify-center px-4 py-3 text-xs text-muted-foreground/70 sm:px-6">
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            CORA · Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
