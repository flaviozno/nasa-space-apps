// TanStack Query hooks for the Earth view. Polling is fast (5 s) because the demo's key moment
// is watching the backlog drain and delayed data arrive right after the link comes back.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { earthApi } from '@/lib/earth-api'

const EARTH_REFRESH_MS = 5_000

export const earthKeys = {
  all: ['earth'] as const,
  sync: () => [...earthKeys.all, 'sync'] as const,
  status: () => [...earthKeys.all, 'status'] as const,
  crew: () => [...earthKeys.all, 'crew'] as const,
  alerts: () => [...earthKeys.all, 'alerts'] as const,
}

export const useSyncStatus = () =>
  useQuery({ queryKey: earthKeys.sync(), queryFn: earthApi.getSyncStatus, refetchInterval: EARTH_REFRESH_MS })

export const useEarthStatus = () =>
  useQuery({ queryKey: earthKeys.status(), queryFn: earthApi.getEarthStatus, refetchInterval: EARTH_REFRESH_MS })

export const useEarthCrew = () =>
  useQuery({ queryKey: earthKeys.crew(), queryFn: earthApi.getEarthCrew, refetchInterval: EARTH_REFRESH_MS })

export const useEarthAlerts = () =>
  useQuery({ queryKey: earthKeys.alerts(), queryFn: earthApi.getEarthAlerts, refetchInterval: EARTH_REFRESH_MS })

/** Cut or restore the simulated link, then refresh everything the Earth view shows. */
export function useSetLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: earthApi.setLink,
    onSuccess: (status) => {
      queryClient.setQueryData(earthKeys.sync(), status)
      queryClient.invalidateQueries({ queryKey: earthKeys.all })
    },
  })
}
