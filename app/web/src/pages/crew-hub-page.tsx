import { Link, Outlet, useParams } from 'react-router'
import { motion } from 'motion/react'
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
    <div className="flex h-full min-h-0 flex-col gap-4 sm:gap-6">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="glass-panel shrink-0 flex flex-wrap items-center gap-4 rounded-3xl border p-4 sm:p-5">
        <CrewAvatar name={member.name} className="size-15 text-xl sm:size-18" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary">ACTIVE CREW PROFILE</p>
          <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">{member.name}</h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base text-muted-foreground">{member.role}</span>
            <DeviceChip deviceId={member.deviceId} className="py-0.5" />
          </div>
        </div>
      </motion.header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6">
        <CrewNavRail
          due={{
            checkin: status.isSuccess && isAvailable(status.data.dailyCheckin, now),
            weekly: status.isSuccess && (isAvailable(status.data.phq4, now) || isAvailable(status.data.teamClimate, now)),
          }}
        />
        <div className="crew-content-frame relative min-h-0 min-w-0 flex-1">
          <div role="region" aria-label="Crew content" tabIndex={0} className="crew-content-scroll h-full overflow-y-auto overscroll-contain pr-1 pb-20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 md:pr-3 md:pb-24">
            <Outlet context={context} />
          </div>
        </div>
      </div>
    </div>
  )
}
