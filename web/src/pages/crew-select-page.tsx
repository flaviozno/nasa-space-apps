import { ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { CrewAvatar } from '@/components/crew-avatar'
import { DeviceChip } from '@/components/device-chip'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { useCrew } from '@/lib/onboard-queries'

/** `/` — astronaut picks themselves (no login in the MVP). Crew comes from `GET /v1/crew`. */
export function CrewSelectPage() {
  const crew = useCrew()

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">Who are you?</h1>
        <p className="text-xl text-muted-foreground">
          Pick your profile to see your levels, trends and today's check-in. You only see your own data.
        </p>
      </div>

      {crew.isPending && (
        <div className="grid gap-5 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingBlock key={index} className="h-56 rounded-3xl" />
          ))}
        </div>
      )}

      {crew.isError && (
        <QueryError error={crew.error} title="Could not load the crew" onRetry={() => crew.refetch()} />
      )}

      {crew.isSuccess && (
        <div className="grid gap-5 sm:grid-cols-2">
          {crew.data.map((member) => (
            <Link
              key={member.crewId}
              to={`/crew/${member.crewId}`}
              className="group flex min-h-56 items-center gap-7 rounded-3xl border-2 bg-card px-8 py-7 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 active:bg-accent"
            >
              <CrewAvatar name={member.name} className="size-24 text-3xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-3xl font-semibold">{member.name}</p>
                <p className="text-xl text-muted-foreground">{member.role}</p>
                <DeviceChip deviceId={member.deviceId} />
              </div>
              <ChevronRightIcon
                className="size-9 text-muted-foreground transition-transform group-hover:translate-x-1 group-active:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
