import { geoEquirectangular, geoGraticule, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import land110m from 'world-atlas/land-110m.json'
import { doseColor, formatCellArea, formatDose, type HeatCell, type PositionedSample } from '@/lib/radiation'
import { cn } from '@/lib/utils'

// Equirectangular, cropped to ±70° latitude: the ISS orbit (51.6° inclination) fits with margin,
// and straight lat/lon lines keep the heat cells as plain rectangles.
const WIDTH = 1000
const HEIGHT = Math.round((WIDTH * 140) / 360)
const projection = geoEquirectangular()
  .scale(WIDTH / (2 * Math.PI))
  .translate([WIDTH / 2, HEIGHT / 2])
  .clipExtent([[0, 0], [WIDTH, HEIGHT]])
const path = geoPath(projection)

// The coastlines ship inside the app (no map tiles): the station display must work offline.
const topology = land110m as unknown as Topology<{ land: GeometryCollection }>
const LAND_PATH = path(feature(topology, topology.objects.land)) ?? ''
const GRATICULE_PATH = path(geoGraticule().step([30, 30])()) ?? ''
const EQUATOR_Y = HEIGHT / 2

const project = (longitude: number, latitude: number) => projection([longitude, latitude]) ?? [0, 0]

interface RadiationMapProps {
  cells: HeatCell[]
  track: PositionedSample[][]
  latest: PositionedSample | null
  peak: PositionedSample | null
  scaleMax: number
  selectedKey: string | null
  onSelect: (key: string | null) => void
}

/** World map with the dose-rate heat grid, the orbit track, and where the station is now. */
export function RadiationMap({ cells, track, latest, peak, scaleMax, selectedKey, onSelect }: RadiationMapProps) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full touch-manipulation select-none"
      role="group"
      aria-label="Map of radiation dose rate along the station orbit"
    >
      <rect width={WIDTH} height={HEIGHT} className="fill-background" onClick={() => onSelect(null)} />
      <path d={GRATICULE_PATH} className="fill-none stroke-border" strokeWidth={1} />
      <line x1={0} x2={WIDTH} y1={EQUATOR_Y} y2={EQUATOR_Y} className="stroke-muted-foreground/40" strokeWidth={1} strokeDasharray="4 6" />
      <path d={LAND_PATH} className="pointer-events-none fill-muted stroke-muted-foreground/30" strokeWidth={0.75} />

      {/* Heat cells: the mark is the tap target; a 2 px gap in the surface color separates neighbours. */}
      {cells.map((cell) => {
        const [x0, y0] = project(cell.lonMin, cell.latMin + cell.sizeDegrees)
        const [x1, y1] = project(cell.lonMin + cell.sizeDegrees, cell.latMin)
        const selected = cell.key === selectedKey
        return (
          <rect
            key={cell.key}
            x={x0}
            y={y0}
            width={x1 - x0}
            height={y1 - y0}
            rx={4}
            fill={doseColor(cell.meanRate, scaleMax)}
            fillOpacity={0.82}
            className={cn('cursor-pointer stroke-background outline-none', selected && 'stroke-foreground')}
            strokeWidth={selected ? 4 : 2}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${formatCellArea(cell)}: ${formatDose(cell.meanRate)} µGy/h average`}
            onClick={() => onSelect(selected ? null : cell.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(selected ? null : cell.key)
              }
            }}
          >
            <title>{`${formatCellArea(cell)} · ${formatDose(cell.meanRate)} µGy/h average`}</title>
          </rect>
        )
      })}

      {/* Orbit track, thin and recessive so the heat reads first. */}
      {track.map((piece, index) => (
        <polyline
          key={index}
          points={piece.map((s) => project(s.longitudeDegrees, s.latitudeDegrees).join(',')).join(' ')}
          className="pointer-events-none fill-none stroke-foreground/70"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {peak && <PeakMarker sample={peak} />}
      {latest && <StationMarker sample={latest} />}
    </svg>
  )
}

function StationMarker({ sample }: { sample: PositionedSample }) {
  const [x, y] = project(sample.longitudeDegrees, sample.latitudeDegrees)
  const labelLeft = x > WIDTH - 90
  return (
    <g className="pointer-events-none" aria-hidden="true">
      <circle cx={x} cy={y} r={16} className="fill-primary/20 motion-safe:animate-pulse" />
      <circle cx={x} cy={y} r={8} className="fill-primary stroke-background" strokeWidth={3} />
      <text
        x={labelLeft ? x - 22 : x + 22}
        y={y + 7}
        textAnchor={labelLeft ? 'end' : 'start'}
        className="fill-foreground stroke-background text-[22px] font-semibold"
        strokeWidth={5}
        paintOrder="stroke"
      >
        ISS now
      </text>
    </g>
  )
}

function PeakMarker({ sample }: { sample: PositionedSample }) {
  const [x, y] = project(sample.longitudeDegrees, sample.latitudeDegrees)
  const labelLeft = x > WIDTH - 140
  return (
    <g className="pointer-events-none" aria-hidden="true">
      <path d={`M ${x} ${y - 11} L ${x + 11} ${y} L ${x} ${y + 11} L ${x - 11} ${y} Z`} className="fill-foreground stroke-background" strokeWidth={3} />
      <text
        x={labelLeft ? x - 18 : x + 18}
        y={y - 12}
        textAnchor={labelLeft ? 'end' : 'start'}
        className="fill-foreground stroke-background text-[20px] font-semibold"
        strokeWidth={5}
        paintOrder="stroke"
      >
        Peak {formatDose(sample.absorbedDoseRateMicroGyPerHour)}
      </text>
    </g>
  )
}
