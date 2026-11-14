import { Link, useParams } from 'react-router'
import { CrewAvatar } from '@/components/crew-avatar'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { useCrew } from '@/lib/onboard-queries'

/** `/crew/:crewId` — Crew Hub (owner: Wallace): levels, trends, alerts, questionnaires, manual entries. */
export function CrewHubPage() {
  const { crewId = '' } = useParams()
  const crew = useCrew()

  if (crew.isPending) return <LoadingBlock className="h-16" />
  if (crew.isError) return <QueryError error={crew.error} onRetry={() => crew.refetch()} />

  const member = crew.data.find((candidate) => candidate.crewId === crewId)
  if (member === undefined) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Unknown crew member</h1>
        <p className="text-muted-foreground">
          There is no crew member "{crewId}". <Link to="/" className="underline">Back to the crew list</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-4">
        <CrewAvatar name={member.name} className="size-14 text-lg" />
        <div>
          <h1 className="text-2xl font-semibold">{member.name}</h1>
          <p className="text-muted-foreground">
            {member.role} · {member.crewId} · {member.deviceId}
          </p>
        </div>
      </header>
      <p className="text-muted-foreground">Metrics, trends and check-in will appear here.</p>
    </section>
  )
}
