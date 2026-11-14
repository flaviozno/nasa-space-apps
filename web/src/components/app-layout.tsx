import { ActivityIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { ServiceStatus } from '@/components/service-status'
import { EARTH_API, ONBOARD_API } from '@/lib/api'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-12 items-center rounded-xl px-4 text-lg font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground active:bg-accent',
  )

/** Shared header with navigation and backend status for every page; sized for touch. */
export function AppLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-4 py-3 md:px-6">
        <Link to="/" className="flex min-h-12 items-center gap-3 text-2xl font-semibold">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ActivityIcon className="size-6" aria-hidden="true" />
          </span>
          Astronaut Health Hub
        </Link>
        <nav className="flex gap-2">
          <NavLink to="/" end className={navClass}>Crew</NavLink>
          <NavLink to="/earth" className={navClass}>Earth view</NavLink>
        </nav>
        <div className="ml-auto flex gap-2">
          <ServiceStatus label="Onboard" baseUrl={ONBOARD_API} />
          <ServiceStatus label="Earth" baseUrl={EARTH_API} />
        </div>
      </header>
      {/* Wide enough for a landscape iPad (1180–1366 px), with touch-friendly side padding. */}
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
