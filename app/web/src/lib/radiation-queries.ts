import { useQuery } from '@tanstack/react-query'
import { radiationApi, RADIATION_WINDOW_MINUTES } from '@/lib/radiation-api'

/** The station moves about 4° of longitude per minute, so a 15 s refresh keeps the marker moving. */
const RADIATION_REFRESH_MS = 15_000

export const radiationKeys = {
  all: ['radiation'] as const,
  track: (windowMinutes: number) => [...radiationKeys.all, 'track', windowMinutes] as const,
}

export const useRadiationTrack = (windowMinutes = RADIATION_WINDOW_MINUTES) =>
  useQuery({
    queryKey: radiationKeys.track(windowMinutes),
    queryFn: () => radiationApi.getTrack(windowMinutes),
    refetchInterval: RADIATION_REFRESH_MS,
  })
