import { RadioTowerIcon, SatelliteDishIcon, SirenIcon, UnplugIcon, ZapIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { CrewAvatar } from '@/components/crew-avatar'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { useNow } from '@/hooks/use-now'
import type { EarthAlert, EarthCrewMember, EarthStatus, SyncStatus } from '@/lib/earth-contract'
import { useEarthAlerts, useEarthCrew, useEarthStatus, useSetLink, useSyncStatus } from '@/lib/earth-queries'
import { describeAlert } from '@/lib/alert-text'
import { displayUnit, formatValue, metricDisplay } from '@/lib/metric-catalog'
import { formatGmtClock } from '@/lib/questionnaire-status'
import { formatAge } from '@/lib/time'
import { bigButton } from '@/lib/touch-styles'
import { cn } from '@/lib/utils'

/** Crew data older than this is marked STALE: batches normally arrive every minute. */
const STALE_AFTER_MS = 2 * 60_000

/**
 * `/earth` — flight surgeon console (owner: Wallace). Shows what has reached Earth, so when the
 * link is down this view falls behind while the spacecraft keeps everything in its outbox.
 */
export function EarthViewPage() {
  const sync = useSyncStatus()
  const earth = useEarthStatus()
  const crew = useEarthCrew()
  const alerts = useEarthAlerts()
  const now = useNow(5_000)

  return (
    <section className="space-y-6 sm:space-y-8">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }} className="max-w-3xl space-y-3 pt-2 sm:pt-6">
        <h1 className="text-4xl font-semibold tracking-tight">Earth view</h1>
        <p className="text-xl text-muted-foreground">
          Flight surgeon console — crew data as received on Earth. When the link is down, this view falls behind; the spacecraft
          keeps everything.
        </p>
      </motion.header>

      {sync.isPending || earth.isPending ? (
        <LoadingBlock className="h-48 rounded-3xl" />
      ) : sync.isError || earth.isError ? (
        <QueryError
          error={(sync.error ?? earth.error)!}
          title="Could not load the link status"
          onRetry={() => {
            sync.refetch()
            earth.refetch()
          }}
        />
      ) : (
        <LinkStatusBand sync={sync.data} earth={earth.data} now={now} />
      )}

      <section aria-label="Crew on Earth" className="space-y-3">
        <h2 className="text-2xl font-semibold">Crew — latest data received</h2>
        {crew.isPending && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <LoadingBlock key={index} className="h-56 rounded-3xl" />
            ))}
          </div>
        )}
        {crew.isError && <QueryError error={crew.error} title="Could not load crew data" onRetry={() => crew.refetch()} />}
        {crew.isSuccess && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {crew.data.map((member) => (
              <EarthCrewCard
                key={member.crewId}
                member={member}
                alert={alerts.data?.find((a) => a.crewId === member.crewId)}
                now={now}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Alerts received on Earth" className="space-y-3">
        <h2 className="text-2xl font-semibold">Alerts and readiness recommendations received on Earth</h2>
        {alerts.isError && <QueryError error={alerts.error} title="Could not load alerts" onRetry={() => alerts.refetch()} />}
        {alerts.isSuccess && alerts.data.length === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-lg text-muted-foreground">No alerts have reached Earth.</p>
        )}
        {alerts.isSuccess && alerts.data.length > 0 && (
          <ul className="space-y-3">
            {alerts.data.map((alert) => (
              <EarthAlertRow key={alert.eventId} alert={alert} crew={crew.data ?? []} />
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function LinkStatusBand({ sync, earth, now }: { sync: SyncStatus; earth: EarthStatus; now: number }) {
  const setLink = useSetLink()
  const online = sync.linkEnabled
  const behindMs = earth.lastReceivedAtMs === null ? null : now - earth.lastReceivedAtMs

  return (
    <section
      aria-label="Link status"
      className={cn(
        'glass-panel space-y-5 rounded-3xl border p-5 transition-colors duration-500 sm:p-6',
        online ? 'border-status-ok/50 bg-status-ok/5' : 'border-status-alert/60 bg-status-alert/10',
      )}
    >
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground">LINK TO SPACECRAFT</p>
          <p className={cn('flex items-center gap-3 text-4xl font-semibold', online ? 'text-status-ok' : 'text-status-alert')}>
            <span className="relative flex size-4">
              {online && <span className="absolute inset-0 animate-ping rounded-full bg-status-ok opacity-60" />}
              <span className={cn('relative size-4 rounded-full', online ? 'bg-status-ok' : 'bg-status-alert')} />
            </span>
            {online ? 'ONLINE' : 'OFFLINE'}
          </p>
          <p className="text-base text-muted-foreground">{online ? 'Outbox draining automatically' : 'Onboard keeps working — events queue up'}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground">PENDING ONBOARD</p>
          <p className="font-mono text-4xl font-semibold tabular-nums" aria-label="Pending events">
            {sync.pendingCount.toLocaleString('en-US')}
          </p>
          <p className="text-base text-muted-foreground">
            {sync.pendingCount === 0
              ? 'Queue is empty'
              : `${sync.pendingAlerts > 0 ? `${sync.pendingAlerts} alert${sync.pendingAlerts > 1 ? 's' : ''} waiting · ` : ''}oldest waiting ${
                  sync.oldestPendingAgeMs === null ? '—' : formatAge(now - sync.oldestPendingAgeMs, now).replace(' ago', '')
                }`}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground">LAST RECEPTION ON EARTH</p>
          <p className="font-mono text-4xl font-semibold tabular-nums">{earth.lastReceivedAtMs === null ? '—' : formatGmtClock(earth.lastReceivedAtMs)}</p>
          <p className={cn('text-base', behindMs !== null && behindMs > STALE_AFTER_MS ? 'font-semibold text-status-warn' : 'text-muted-foreground')}>
            {earth.lastReceivedAtMs === null
              ? 'Nothing received yet'
              : behindMs !== null && behindMs > STALE_AFTER_MS
                ? `${formatAge(earth.lastReceivedAtMs, now)} — Earth data is behind`
                : `Up to date · ${earth.eventsReceived.toLocaleString('en-US')} events received`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-current/10 pt-4">
        <span className="text-sm font-semibold tracking-widest text-muted-foreground">DEMO CONTROL</span>
        <button
          type="button"
          onClick={() => setLink.mutate(!online)}
          disabled={setLink.isPending}
          className={cn(
            bigButton,
            'border-2',
            online ? 'border-status-alert/70 bg-status-alert/15 active:bg-status-alert/25' : 'border-status-ok/70 bg-status-ok/15 active:bg-status-ok/25',
          )}
        >
          {online ? <UnplugIcon className="size-6" aria-hidden="true" /> : <ZapIcon className="size-6" aria-hidden="true" />}
          {online ? 'Cut the link' : 'Restore the link'}
        </button>
        {setLink.isError && (
          <p role="alert" className="text-base font-semibold text-status-alert">
            Could not change the link: {setLink.error.message}
          </p>
        )}
      </div>
    </section>
  )
}

function EarthCrewCard({ member, alert, now }: { member: EarthCrewMember; alert: EarthAlert | undefined; now: number }) {
  const newest = member.metrics.reduce<number | null>((latest, m) => (latest === null || m.takenAt > latest ? m.takenAt : latest), null)
  const stale = newest !== null && now - newest > STALE_AFTER_MS
  const chip = alert
    ? { label: 'Alert', className: 'bg-status-alert/20 text-status-alert' }
    : stale
      ? { label: 'Data delayed', className: 'bg-status-warn/20 text-status-warn' }
      : { label: 'Nominal', className: 'bg-status-ok/15 text-status-ok' }

  return (
    <article
      aria-label={member.name}
      className={cn(
        'flex flex-col gap-4 rounded-3xl border-2 bg-card p-5 transition-opacity duration-500',
        alert ? 'border-status-alert/60' : stale ? 'border-status-warn/40' : 'border-border',
        stale && !alert && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <CrewAvatar name={member.name} className="size-12 text-base" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xl leading-tight font-semibold">{member.name}</p>
          <p className="text-base leading-tight text-muted-foreground">{member.role}</p>
          <span className={cn('inline-block rounded-full px-3 py-0.5 text-sm font-semibold', chip.className)}>{chip.label}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {member.metrics.map((m) => {
          const flagged = alert?.metric === m.metric
          return (
            <div key={m.metric} className="space-y-0.5">
              <dt className="text-sm text-muted-foreground">{metricDisplay(m.metric).label}</dt>
              <dd className={cn('font-mono text-3xl font-semibold tabular-nums', flagged && 'text-status-alert')}>{formatValue(m.metric, m.value)}</dd>
              <dd className="text-sm text-muted-foreground">{displayUnit(m.unit)}</dd>
            </div>
          )
        })}
      </dl>

      <p className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 text-base text-muted-foreground">
        {newest === null ? 'No data yet' : `Data from ${formatGmtClock(newest)} · ${formatAge(newest, now)}`}
        {stale && (
          <span className="animate-pulse rounded-full bg-status-warn/20 px-2.5 py-0.5 text-sm font-bold tracking-wider text-status-warn">
            STALE
          </span>
        )}
      </p>
    </article>
  )
}

function EarthAlertRow({ alert, crew }: { alert: EarthAlert; crew: EarthCrewMember[] }) {
  const name = crew.find((member) => member.crewId === alert.crewId)?.name ?? alert.crewId
  const delayMinutes = Math.round((alert.receivedAtMs - alert.createdAtOnboardMs) / 60_000)
  const text = describeAlert(alert, 'the')
  const readiness = alert.recommendationStatus

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-status-alert/50 bg-status-alert/10 p-4 animate-in fade-in slide-in-from-left-2">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-status-alert/20 text-status-alert">
        <SirenIcon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xl font-semibold">
          {name} — {text.title}
          {text.reading && <span className="text-status-alert"> {text.reading}</span>}
        </p>
        {readiness && (
          <>
            <p className="text-base font-semibold text-status-alert">{readiness.replaceAll('_', ' ')}</p>
            <p className="text-base text-muted-foreground">{alert.message}</p>
            {alert.evidence && <p className="text-sm text-muted-foreground">Evidence: {alert.evidence.map((item) => `${item.label} ${item.value} ${item.unit}`).join(' Â· ')}</p>}
            {alert.disclaimer && <p className="text-sm text-muted-foreground">{alert.disclaimer}</p>}
          </>
        )}
        {!readiness && text.deviation && (
          <p className="text-base text-muted-foreground" title={alert.message}>
            {text.deviation}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 text-base">
        <span className="flex items-center gap-1.5">
          <RadioTowerIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          Onboard {formatGmtClock(alert.createdAtOnboardMs)}
        </span>
        <span aria-hidden="true">→</span>
        <span className="flex items-center gap-1.5">
          <SatelliteDishIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          Earth {formatGmtClock(alert.receivedAtMs)}
        </span>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-semibold',
            delayMinutes >= 1 ? 'bg-status-warn/20 text-status-warn' : 'bg-status-ok/15 text-status-ok',
          )}
        >
          {delayMinutes >= 1 ? `${delayMinutes} min delay` : 'no delay'}
        </span>
      </div>
    </li>
  )
}
