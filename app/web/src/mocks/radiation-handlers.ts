// Mock of the onboard radiation route. Replays ~2 h of real ISS DosTel readings
// (fixtures/iss-radiation.json, the same snapshot the wearable emulator bundles) in a loop
// aligned to the clock, so the station marker moves forward as time passes.

import { http, HttpResponse } from 'msw'
import { ONBOARD_API } from '@/lib/api'
import type { RadiationSample, RadiationTrack } from '@/lib/radiation-contract'
import radiationFixture from './fixtures/iss-radiation.json'

type FixtureSample = Omit<RadiationSample, 'takenAtMs'>

const SOURCE = 'ISS DosTel, NASA OSDR RadLab (April 2022 records, replayed)'
const fixtureSamples = radiationFixture.samples as FixtureSample[]
const firstMs = Date.parse(fixtureSamples[0].sourceTimestamp)
const replay = fixtureSamples.map((sample) => ({ sample, offsetMs: Date.parse(sample.sourceTimestamp) - firstMs }))
/** One loop of the recording; the extra 30 s is the usual spacing between readings. */
const CYCLE_MS = replay[replay.length - 1].offsetMs + 30_000

/** The readings of the last `windowMinutes`, as if acquired live. Oldest first. */
export function replayRadiation(now: number, windowMinutes: number): RadiationTrack {
  const windowMs = Math.min(windowMinutes * 60_000, CYCLE_MS - 1)
  const position = now % CYCLE_MS
  const samples = replay
    .map(({ sample, offsetMs }) => {
      // Readings later in the recording than `position` belong to the previous loop.
      const ageMs = (position - offsetMs + CYCLE_MS) % CYCLE_MS
      return { ...sample, takenAtMs: now - ageMs }
    })
    .filter((sample) => now - sample.takenAtMs <= windowMs)
    .sort((a, b) => a.takenAtMs - b.takenAtMs)
  return { generatedAtMs: now, windowMinutes, source: SOURCE, samples }
}

export const radiationHandlers = [
  http.get(`${ONBOARD_API}/v1/environment/radiation`, ({ request }) => {
    const requested = Number(new URL(request.url).searchParams.get('windowMinutes') ?? 120)
    const windowMinutes = Number.isFinite(requested) ? Math.min(1440, Math.max(1, Math.round(requested))) : 120
    return HttpResponse.json(replayRadiation(Date.now(), windowMinutes))
  }),
]
