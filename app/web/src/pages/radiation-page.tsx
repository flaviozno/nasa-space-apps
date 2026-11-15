import { InfoIcon, RadiationIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { LoadingBlock, QueryError } from '@/components/query-state'
import { RadiationMap } from '@/components/radiation-map'
import { useNow } from '@/hooks/use-now'
import { formatGmtClock } from '@/lib/questionnaire-status'
import {
  binRadiation,
  DOSE_GRADIENT,
  doseColor,
  doseScaleMax,
  formatCellArea,
  formatDose,
  formatLatLon,
  hasPosition,
  type HeatCell,
  splitTrack,
  summarizeRadiation,
} from '@/lib/radiation'
import type { RadiationSample } from '@/lib/radiation-contract'
import { useRadiationTrack } from '@/lib/radiation-queries'
import { formatAge } from '@/lib/time'
import { cn } from '@/lib/utils'

const TOP_REGIONS = 5

/**
 * `/radiation` — where along its orbit the station meets more radiation. A heat map of ISS
 * DosTel dose rate by 15° region, the orbit track, and summary numbers for the last 2 h.
 * Environmental readings shared by the whole crew, not anyone's personal dose.
 */
export function RadiationPage() {
  const track = useRadiationTrack()
  const now = useNow(15_000)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showAllRegions, setShowAllRegions] = useState(false)

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight">
          <RadiationIcon className="size-9 text-primary" aria-hidden="true" />
          Station radiation
        </h1>
        <p className="text-xl text-muted-foreground">Where along the orbit the station met more radiation in the last 2 hours.</p>
      </div>

      {track.isPending && (
        <div className="space-y-5" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <LoadingBlock key={index} className="h-36 rounded-3xl" />)}
          </div>
          <LoadingBlock className="h-96 rounded-3xl" />
        </div>
      )}

      {track.isError && <QueryError error={track.error} title="Could not load radiation readings" onRetry={() => track.refetch()} />}

      {track.isSuccess && (
        <RadiationContent
          samples={track.data.samples}
          source={track.data.source}
          now={now}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          showAllRegions={showAllRegions}
          onToggleRegions={() => setShowAllRegions((value) => !value)}
        />
      )}
    </section>
  )
}

interface RadiationContentProps {
  samples: RadiationSample[]
  source: string
  now: number
  selectedKey: string | null
  onSelect: (key: string | null) => void
  showAllRegions: boolean
  onToggleRegions: () => void
}

function RadiationContent({ samples, source, now, selectedKey, onSelect, showAllRegions, onToggleRegions }: RadiationContentProps) {
  const summary = summarizeRadiation(samples)
  if (!summary) {
    return <p className="rounded-3xl border-2 border-dashed p-10 text-center text-xl text-muted-foreground">No radiation readings in the last 2 hours.</p>
  }

  const cells = binRadiation(samples)
  const scaleMax = doseScaleMax(summary.peak.absorbedDoseRateMicroGyPerHour)
  const latest = hasPosition(summary.latest) ? summary.latest : null
  const peak = hasPosition(summary.peak) ? summary.peak : null
  const selected = cells.find((cell) => cell.key === selectedKey) ?? null
  const shownCells = showAllRegions ? cells : cells.slice(0, TOP_REGIONS)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Now"
          value={formatDose(summary.latest.absorbedDoseRateMicroGyPerHour)}
          unit="µGy/h"
          detail={`${latest ? formatLatLon(latest.latitudeDegrees, latest.longitudeDegrees) + ' · ' : ''}${formatAge(summary.latest.takenAtMs, now)}`}
        />
        <StatTile
          label="Peak, last 2 h"
          value={formatDose(summary.peak.absorbedDoseRateMicroGyPerHour)}
          unit="µGy/h"
          detail={`${peak ? formatLatLon(peak.latitudeDegrees, peak.longitudeDegrees) + ' · ' : ''}${formatGmtClock(summary.peak.takenAtMs)}`}
        />
        <StatTile label="Average" value={formatDose(summary.meanRate)} unit="µGy/h" detail={`${samples.length} readings`} />
        <StatTile
          label="Accumulated, last 2 h"
          value={formatDose(summary.accumulatedMicroGy)}
          unit="µGy"
          detail="Station environment, not a personal dose"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Radiation map" className="space-y-4 self-start rounded-3xl border-2 bg-card p-4 md:p-5">
          <div className="overflow-hidden rounded-2xl border">
            <RadiationMap
              cells={cells}
              track={splitTrack(samples)}
              latest={latest}
              peak={peak}
              scaleMax={scaleMax}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          </div>
          <MapLegend scaleMax={scaleMax} />
        </section>

        <aside className="space-y-4">
          {selected && <RegionDetail cell={selected} scaleMax={scaleMax} onClose={() => onSelect(null)} />}

          <section aria-label="Regions by dose rate" className="space-y-3 rounded-3xl border-2 bg-card p-4 md:p-5">
            <h2 className="text-2xl font-semibold">Highest regions</h2>
            <p className="text-base text-muted-foreground">Average dose rate per 15° square. Tap one to find it on the map.</p>
            <ol className="space-y-2">
              {shownCells.map((cell, index) => (
                <li key={cell.key}>
                  <button
                    type="button"
                    aria-pressed={cell.key === selectedKey}
                    onClick={() => onSelect(cell.key === selectedKey ? null : cell.key)}
                    className={cn(
                      'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
                      cell.key === selectedKey ? 'border-primary bg-accent' : 'border-transparent bg-muted/50 active:bg-accent',
                    )}
                  >
                    <span className="w-6 text-lg font-semibold text-muted-foreground">{index + 1}</span>
                    <span className="size-6 shrink-0 rounded-md" style={{ background: doseColor(cell.meanRate, scaleMax) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-base">{formatCellArea(cell)}</span>
                    <span className="font-mono text-xl font-semibold tabular-nums">{formatDose(cell.meanRate)}</span>
                  </button>
                </li>
              ))}
            </ol>
            {cells.length > TOP_REGIONS && (
              <button
                type="button"
                onClick={onToggleRegions}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 text-lg font-semibold active:bg-accent"
              >
                {showAllRegions ? 'Show top 5' : `Show all ${cells.length} regions`}
              </button>
            )}
          </section>
        </aside>
      </div>

      <p className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-base text-muted-foreground">
        <InfoIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          Readings describe the radiation environment inside the station, shared by the whole crew. They are not a
          personal dose for any crew member. Source: {source}.
        </span>
      </p>
    </>
  )
}

function StatTile({ label, value, unit, detail }: { label: string; value: string; unit: string; detail: string }) {
  return (
    <div className="space-y-2 rounded-3xl border-2 bg-card p-5">
      <p className="text-lg text-muted-foreground">{label}</p>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-5xl font-semibold tabular-nums">{value}</span>
        <span className="text-xl text-muted-foreground">{unit}</span>
      </p>
      <p className="text-base text-muted-foreground">{detail}</p>
    </div>
  )
}

function MapLegend({ scaleMax }: { scaleMax: number }) {
  const ticks = [0, scaleMax / 3, (2 * scaleMax) / 3, scaleMax]
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
      <div className="min-w-64 flex-1 space-y-1.5">
        <p className="text-base font-medium">Average dose rate (µGy/h)</p>
        <div className="h-4 rounded-full" style={{ background: DOSE_GRADIENT }} aria-hidden="true" />
        <div className="flex justify-between font-mono text-sm text-muted-foreground tabular-nums">
          {ticks.map((tick, index) => (
            <span key={tick}>{index === ticks.length - 1 ? `${tick}+` : Math.round(tick)}</span>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-base text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="size-4 rounded-full border-2 border-background bg-primary ring-4 ring-primary/25" aria-hidden="true" />
          ISS now
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rotate-45 bg-foreground" aria-hidden="true" />
          Peak reading
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-foreground/70" aria-hidden="true" />
          Orbit track
        </li>
      </ul>
    </div>
  )
}

function RegionDetail({ cell, scaleMax, onClose }: { cell: HeatCell; scaleMax: number; onClose: () => void }) {
  return (
    <section aria-label="Selected region" className="space-y-3 rounded-3xl border-2 border-primary bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground">SELECTED REGION</p>
          <h2 className="text-xl font-semibold">{formatCellArea(cell)}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear selection"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 active:bg-accent"
        >
          <XIcon className="size-6" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="size-8 rounded-lg" style={{ background: doseColor(cell.meanRate, scaleMax) }} aria-hidden="true" />
        <span className="font-mono text-4xl font-semibold tabular-nums">{formatDose(cell.meanRate)}</span>
        <span className="text-lg text-muted-foreground">µGy/h average</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-base">
        <div>
          <dt className="text-muted-foreground">Highest</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums">{formatDose(cell.maxRate)} µGy/h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Readings</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums">{cell.count}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Last pass</dt>
          <dd className="text-xl font-semibold">{formatGmtClock(cell.lastPassAtMs)}</dd>
        </div>
      </dl>
    </section>
  )
}
