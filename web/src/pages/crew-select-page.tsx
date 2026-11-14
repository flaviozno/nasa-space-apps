import { ChevronRightIcon, WatchIcon } from 'lucide-react'
import { Link } from 'react-router'
import { CrewAvatar } from '@/components/crew-avatar'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCrew } from '@/lib/onboard-queries'

/** `/` — astronaut picks themselves (no login in the MVP). Crew comes from `GET /v1/crew`. */
export function CrewSelectPage() {
  const crew = useCrew()

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Who are you?</h1>
        <p className="text-muted-foreground">
          Pick your profile to see your levels, trends and today's check-in. You only see your own data.
        </p>
      </div>

      {crew.isPending && (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingBlock key={index} className="h-24" />
          ))}
        </div>
      )}

      {crew.isError && (
        <QueryError error={crew.error} title="Could not load the crew" onRetry={() => crew.refetch()} />
      )}

      {crew.isSuccess && (
        <div className="grid gap-3 sm:grid-cols-2">
          {crew.data.map((member) => (
            <Link
              key={member.crewId}
              to={`/crew/${member.crewId}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors group-hover:border-primary/50 group-hover:bg-muted/50">
                <CardHeader className="flex flex-row items-center gap-4">
                  <CrewAvatar name={member.name} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle>{member.name}</CardTitle>
                    <CardDescription>{member.role}</CardDescription>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <WatchIcon className="size-3" aria-hidden="true" />
                      {member.deviceId}
                    </p>
                  </div>
                  <ChevronRightIcon
                    className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
