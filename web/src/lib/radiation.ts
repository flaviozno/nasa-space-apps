// Pure helpers for the station radiation view: summary numbers, the heat-map grid, the
// orbit track, and the dose-rate color scale. Units: dose rate in µGy/h, dose in µGy.

import type { RadiationSample } from '@/lib/radiation-contract'

export type PositionedSample = RadiationSample & { latitudeDegrees: number; longitudeDegrees: number }

export const hasPosition = (sample: RadiationSample): sample is PositionedSample =>
  sample.latitudeDegrees !== null && sample.longitudeDegrees !== null

export interface RadiationSummary {
  latest: RadiationSample
  peak: RadiationSample
  meanRate: number
  /** Dose accumulated over the readings (trapezoid rule), in µGy. */
  accumulatedMicroGy: number
  /** Time between the first and the last reading. */
  spanMs: number
}

/** Readings further apart than this are a gap: no dose is assumed in between. */
const MAX_INTEGRATION_GAP_MS = 10 * 60_000

/** Null when there are no readings. Example: two readings of 6 µGy/h one hour apart → 6 µGy accumulated. */
export function summarizeRadiation(samples: RadiationSample[]): RadiationSummary | null {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a.takenAtMs - b.takenAtMs)
  let accumulated = 0
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = sorted[i].takenAtMs - sorted[i - 1].takenAtMs
    if (gapMs > MAX_INTEGRATION_GAP_MS) continue
    const meanRate = (sorted[i].absorbedDoseRateMicroGyPerHour + sorted[i - 1].absorbedDoseRateMicroGyPerHour) / 2
    accumulated += (meanRate * gapMs) / 3_600_000
  }
  const total = sorted.reduce((sum, s) => sum + s.absorbedDoseRateMicroGyPerHour, 0)
  return {
    latest: sorted[sorted.length - 1],
    peak: sorted.reduce((max, s) => (s.absorbedDoseRateMicroGyPerHour > max.absorbedDoseRateMicroGyPerHour ? s : max)),
    meanRate: total / sorted.length,
    accumulatedMicroGy: accumulated,
    spanMs: sorted[sorted.length - 1].takenAtMs - sorted[0].takenAtMs,
  }
}

export interface HeatCell {
  /** "45:-105" — south-west corner, stable across refreshes. */
  key: string
  latMin: number
  lonMin: number
  sizeDegrees: number
  meanRate: number
  maxRate: number
  count: number
  lastPassAtMs: number
}

/** 15° squares: about 40 px on a tablet-width map, big enough to tap. */
export const HEAT_CELL_DEGREES = 15

/** Groups positioned readings into lat/lon squares; sorted by mean dose rate, highest first. */
export function binRadiation(samples: RadiationSample[], sizeDegrees = HEAT_CELL_DEGREES): HeatCell[] {
  const cells = new Map<string, HeatCell & { total: number }>()
  for (const sample of samples.filter(hasPosition)) {
    const latMin = Math.floor(sample.latitudeDegrees / sizeDegrees) * sizeDegrees
    // Longitude 180 belongs to the last column, not a 13th one.
    const lonMin = Math.min(Math.floor(sample.longitudeDegrees / sizeDegrees) * sizeDegrees, 180 - sizeDegrees)
    const key = `${latMin}:${lonMin}`
    const rate = sample.absorbedDoseRateMicroGyPerHour
    const cell = cells.get(key)
    if (cell) {
      cell.total += rate
      cell.count += 1
      cell.maxRate = Math.max(cell.maxRate, rate)
      cell.lastPassAtMs = Math.max(cell.lastPassAtMs, sample.takenAtMs)
    } else {
      cells.set(key, { key, latMin, lonMin, sizeDegrees, total: rate, meanRate: 0, maxRate: rate, count: 1, lastPassAtMs: sample.takenAtMs })
    }
  }
  return [...cells.values()]
    .map(({ total, ...cell }) => ({ ...cell, meanRate: total / cell.count }))
    .sort((a, b) => b.meanRate - a.meanRate)
}

/**
 * The orbit as drawable pieces, oldest first. A new piece starts where a line would cut across
 * the map: crossing the 180° meridian, a jump in position, or a gap in the readings.
 */
export function splitTrack(samples: RadiationSample[]): PositionedSample[][] {
  const pieces: PositionedSample[][] = []
  let current: PositionedSample[] = []
  for (const sample of [...samples].filter(hasPosition).sort((a, b) => a.takenAtMs - b.takenAtMs)) {
    const previous = current[current.length - 1]
    const breaks =
      previous !== undefined &&
      (Math.abs(sample.longitudeDegrees - previous.longitudeDegrees) > 180 ||
        Math.abs(sample.latitudeDegrees - previous.latitudeDegrees) > 15 ||
        sample.takenAtMs - previous.takenAtMs > 5 * 60_000)
    if (breaks) {
      pieces.push(current)
      current = []
    }
    current.push(sample)
  }
  if (current.length > 0) pieces.push(current)
  return pieces
}

/** Upper end of the color scale: fixed at 15 µGy/h so colors mean the same thing every refresh. */
export function doseScaleMax(peakRate: number): number {
  return Math.max(15, Math.ceil(peakRate / 5) * 5)
}

// One-hue sequential ramp (magenta), dark → bright, so low dose recedes into the dark map and
// high dose stands out. Lightness rises monotonically; status colors stay reserved for alerts.
const RAMP = [
  { l: 0.38, c: 0.12, h: 328 },
  { l: 0.58, c: 0.2, h: 332 },
  { l: 0.76, c: 0.17, h: 336 },
  { l: 0.93, c: 0.07, h: 340 },
]

/** Color for a dose rate on a 0…max scale. Example: `doseColor(12, 15)` → a bright magenta. */
export function doseColor(rate: number, max: number): string {
  const t = Math.min(1, Math.max(0, rate / max)) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(t))
  const f = t - i
  const mix = (a: number, b: number) => a + (b - a) * f
  const [a, b] = [RAMP[i], RAMP[i + 1]]
  return `oklch(${mix(a.l, b.l).toFixed(3)} ${mix(a.c, b.c).toFixed(3)} ${mix(a.h, b.h).toFixed(1)})`
}

/** CSS gradient for the legend, matching doseColor. */
export const DOSE_GRADIENT = `linear-gradient(to right, ${RAMP.map((s) => `oklch(${s.l} ${s.c} ${s.h})`).join(', ')})`

/** "49°S 89°E". */
export function formatLatLon(latitude: number, longitude: number): string {
  const lat = `${Math.round(Math.abs(latitude))}°${latitude < 0 ? 'S' : 'N'}`
  const lon = `${Math.round(Math.abs(longitude))}°${longitude < 0 ? 'W' : 'E'}`
  return `${lat} ${lon}`
}

/** One side of a cell: "45–60°N", "90–105°W"; across the equator or prime meridian "0–15°N". */
function formatRange(min: number, max: number, negative: string, positive: string): string {
  const [low, high] = [Math.abs(min), Math.abs(max)].sort((a, b) => a - b)
  return `${low}–${high}°${max <= 0 ? negative : positive}`
}

/** "45–60°N, 90–105°W" for a heat cell. */
export function formatCellArea(cell: HeatCell): string {
  const size = cell.sizeDegrees
  return `${formatRange(cell.latMin, cell.latMin + size, 'S', 'N')}, ${formatRange(cell.lonMin, cell.lonMin + size, 'W', 'E')}`
}

/** Dose rates and doses with one decimal: 12.6. */
export const formatDose = (value: number) => value.toFixed(1)
