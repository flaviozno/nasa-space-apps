import { describe, expect, it } from 'vitest'
import { replayRadiation } from '@/mocks/radiation-handlers'
import {
  binRadiation,
  doseScaleMax,
  formatCellArea,
  formatLatLon,
  splitTrack,
  summarizeRadiation,
} from '@/lib/radiation'
import type { RadiationSample } from '@/lib/radiation-contract'

const HOUR = 3_600_000

function sample(takenAtMs: number, rate: number, latitude: number | null = 0, longitude: number | null = 0): RadiationSample {
  return {
    takenAtMs,
    sourceTimestamp: '2022-04-01T23:00:00Z',
    instrumentId: 'DosTel1',
    absorbedDoseRateMicroGyPerHour: rate,
    latitudeDegrees: latitude,
    longitudeDegrees: longitude,
    altitudeKilometers: 420,
    particleFluxPerCm2SrSecond: null,
  }
}

describe('summarizeRadiation', () => {
  it('returns null without readings', () => {
    expect(summarizeRadiation([])).toBeNull()
  })

  it('finds latest and peak and integrates the dose over time', () => {
    const fiveMinutes = HOUR / 12
    const summary = summarizeRadiation([sample(0, 4), sample(fiveMinutes, 12), sample(2 * fiveMinutes, 8)])!
    expect(summary.latest.takenAtMs).toBe(2 * fiveMinutes)
    expect(summary.peak.absorbedDoseRateMicroGyPerHour).toBe(12)
    expect(summary.meanRate).toBe(8)
    // (4+12)/2 µGy/h × 1/12 h + (12+8)/2 µGy/h × 1/12 h = 8/12 + 10/12
    expect(summary.accumulatedMicroGy).toBeCloseTo(1.5)
  })

  it('does not assume any dose across a gap in the readings', () => {
    const summary = summarizeRadiation([sample(0, 6), sample(HOUR, 6)])!
    expect(summary.accumulatedMicroGy).toBe(0)
  })
})

describe('binRadiation', () => {
  it('groups readings into 15° squares, highest average first', () => {
    const cells = binRadiation([sample(1, 10, 50, -100), sample(2, 12, 52, -95), sample(3, 3, 5, 5), sample(4, 7, null, null)])
    expect(cells.map((c) => c.key)).toEqual(['45:-105', '0:0'])
    expect(cells[0]).toMatchObject({ meanRate: 11, maxRate: 12, count: 2, lastPassAtMs: 2 })
  })

  it('keeps longitude 180 in the last column', () => {
    expect(binRadiation([sample(1, 5, 10, 180)])[0].lonMin).toBe(165)
  })
})

describe('splitTrack', () => {
  it('starts a new piece when the orbit crosses the 180° meridian', () => {
    const pieces = splitTrack([sample(0, 1, 10, 170), sample(60_000, 1, 12, 178), sample(120_000, 1, 14, -174)])
    expect(pieces.map((p) => p.length)).toEqual([2, 1])
  })

  it('drops readings without a position', () => {
    expect(splitTrack([sample(0, 1, null, null)])).toEqual([])
  })
})

describe('formatting', () => {
  it('writes coordinates and cell areas with hemispheres', () => {
    expect(formatLatLon(-49.4, 89.2)).toBe('49°S 89°E')
    const [cell] = binRadiation([sample(1, 5, 50, -100)])
    expect(formatCellArea(cell)).toBe('45–60°N, 90–105°W')
    const [southWest] = binRadiation([sample(1, 5, -50, -10)])
    expect(formatCellArea(southWest)).toBe('45–60°S, 0–15°W')
  })

  it('keeps the color scale fixed unless the peak goes above it', () => {
    expect(doseScaleMax(12.6)).toBe(15)
    expect(doseScaleMax(31)).toBe(35)
  })
})

describe('replayRadiation (mock)', () => {
  it('returns the last 2 h of real readings, oldest first, ending now', () => {
    const now = Date.UTC(2026, 10, 14, 12, 0, 0)
    const track = replayRadiation(now, 120)
    expect(track.samples.length).toBeGreaterThan(150)
    const times = track.samples.map((s) => s.takenAtMs)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(now - times[0]).toBeLessThanOrEqual(120 * 60_000)
    expect(times[times.length - 1]).toBeLessThanOrEqual(now)
  })

  it('moves the station forward as time passes', () => {
    const now = Date.UTC(2026, 10, 14, 12, 0, 0)
    const before = replayRadiation(now, 120).samples.at(-1)!
    const after = replayRadiation(now + 10 * 60_000, 120).samples.at(-1)!
    expect(after.sourceTimestamp).not.toBe(before.sourceTimestamp)
  })
})
