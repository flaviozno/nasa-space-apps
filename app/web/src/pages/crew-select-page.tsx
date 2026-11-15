import { ChevronRightIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { CrewAvatar } from '@/components/crew-avatar'
import { DeviceChip } from '@/components/device-chip'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { useCrew } from '@/lib/onboard-queries'

/** `/` — astronaut picks themselves (no login in the MVP). Crew comes from `GET /v1/crew`. */
export function CrewSelectPage() {
  const crew = useCrew()

  return (
    <section className="space-y-7 sm:space-y-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-2xl space-y-3 pt-2 sm:pt-6">
        <p className="text-xs font-bold tracking-[0.22em] text-primary">LOCAL ACCESS</p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Select your profile.</h1>
        <p className="text-lg text-muted-foreground sm:text-xl">Your data stays local to the mission.</p>
      </motion.div>

      {crew.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingBlock key={index} className="h-56 rounded-3xl" />
          ))}
        </div>
      )}

      {crew.isError && (
        <QueryError error={crew.error} title="Could not load the crew" onRetry={() => crew.refetch()} />
      )}

      {crew.isSuccess && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
          {crew.data.map((member, index) => (
            <motion.div key={member.crewId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }}>
            <Link
              to={`/crew/${member.crewId}`}
              className="group glass-panel flex min-h-36 items-center gap-4 rounded-3xl border px-5 py-5 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_20px_45px_-30px_var(--primary)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-[0.99] sm:min-h-56 sm:gap-7 sm:px-8 sm:py-7"
            >
              <CrewAvatar name={member.name} className="size-16 text-xl sm:size-24 sm:text-3xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{member.name}</p>
                <p className="text-base text-muted-foreground sm:text-xl">{member.role}</p>
                <DeviceChip deviceId={member.deviceId} />
              </div>
              <ChevronRightIcon
                className="size-6 text-muted-foreground transition-transform group-hover:translate-x-1 group-active:translate-x-1 sm:size-9"
                aria-hidden="true"
              />
            </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  )
}
