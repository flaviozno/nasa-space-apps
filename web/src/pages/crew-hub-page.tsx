import { Link, Outlet, useParams } from 'react-router'
import { CrewAvatar } from '@/components/crew-avatar'
import { CrewNavRail } from '@/components/crew-nav-rail'
import { DeviceChip } from '@/components/device-chip'
import { LoadingBlock, QueryError } from '@/components/query-state'
import type { CrewHubContext } from '@/lib/crew-hub-context'
import { useNow } from '@/hooks/use-now'
import { useCrew, useQuestionnaireStatus } from '@/lib/onboard-queries'
import { isAvailable } from '@/lib/questionnaire-status'

/**
 * `/crew/:crewId` — Crew Hub (owner: Wallace). Shell shared by its sections: who is signed in,
 * the touch navigation rail, and the active section (overview, check-in, weekly, manual).
 */
export function CrewHubPage() {
  const { crewId = '' } = useParams()
  const crew = useCrew()
  const status = useQuestionnaireStatus(crewId)
  const now = useNow()

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

  const context: CrewHubContext = { member }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-4">
        <CrewAvatar name={member.name} className="size-16 text-xl" />
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">{member.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg text-muted-foreground">{member.role}</span>
            <DeviceChip deviceId={member.deviceId} className="py-0.5" />
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-4 md:flex-row">
        <CrewNavRail
          due={{
            checkin: status.isSuccess && isAvailable(status.data.dailyCheckin, now),
            weekly: status.isSuccess && (isAvailable(status.data.phq4, now) || isAvailable(status.data.teamClimate, now)),
          }}
        />
        <div className="min-w-0 flex-1">
          <Outlet context={context} />
        </div>
      </div>
    </div>
  )
}
