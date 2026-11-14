import { Link, Outlet } from 'react-router'
import { ServiceStatus } from '@/components/service-status'
import { EARTH_API, ONBOARD_API } from '@/lib/api'

/** Shared header with navigation and backend status for every page. */
export function AppLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
        <Link to="/" className="font-semibold">Astronaut Health Hub</Link>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link to="/">Crew</Link>
          <Link to="/earth">Earth view</Link>
        </nav>
        <div className="ml-auto flex gap-2">
          <ServiceStatus label="Onboard" baseUrl={ONBOARD_API} />
          <ServiceStatus label="Earth" baseUrl={EARTH_API} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
