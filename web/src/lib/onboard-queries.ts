// TanStack Query hooks for the onboard Crew API. Pages use these instead of calling fetch.
//
// Wearable data reaches onboard in 1-minute batches, so polling every 30 s is enough to
// show a new batch soon after it lands without hammering the API.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, onboardApi, type TrendOptions } from '@/lib/onboard-api'
import { OPEN_STATUS } from '@/lib/questionnaire-status'

const LIVE_REFRESH_MS = 30_000
const ALERT_REFRESH_MS = 15_000

/** Query keys; everything about one crew member lives under `onboardKeys.member(crewId)`. */
export const onboardKeys = {
  all: ['onboard'] as const,
  crew: () => [...onboardKeys.all, 'crew'] as const,
  member: (crewId: string) => [...onboardKeys.crew(), crewId] as const,
  baseline: (crewId: string) => [...onboardKeys.member(crewId), 'baseline'] as const,
  metrics: (crewId: string) => [...onboardKeys.member(crewId), 'metrics'] as const,
  trend: (crewId: string, metric: string, options: TrendOptions) =>
    [...onboardKeys.member(crewId), 'trend', metric, options] as const,
  alerts: (crewId: string) => [...onboardKeys.member(crewId), 'alerts'] as const,
  questionnaireStatus: (crewId: string) => [...onboardKeys.member(crewId), 'questionnaire-status'] as const,
}

/** Which questionnaires can be answered now; refetched after every submission (same member key). */
export function useQuestionnaireStatus(crewId: string) {
  return useQuery({
    queryKey: onboardKeys.questionnaireStatus(crewId),
    // Until the onboard API implements the endpoint (404), treat everything as open.
    queryFn: () =>
      onboardApi.getQuestionnaireStatus(crewId).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404 && !String(error.message).startsWith('unknown crewId')) {
          return OPEN_STATUS
        }
        throw error
      }),
    refetchInterval: 60_000,
  })
}

export function useCrew() {
  return useQuery({ queryKey: onboardKeys.crew(), queryFn: onboardApi.listCrew, staleTime: Infinity })
}

/** Fixed per crew member (contracts/crew.json), so it is fetched once. */
export function useBaseline(crewId: string) {
  return useQuery({
    queryKey: onboardKeys.baseline(crewId),
    queryFn: () => onboardApi.getBaseline(crewId),
    staleTime: Infinity,
  })
}

export function useCrewMetrics(crewId: string) {
  return useQuery({
    queryKey: onboardKeys.metrics(crewId),
    queryFn: () => onboardApi.getMetrics(crewId),
    refetchInterval: LIVE_REFRESH_MS,
  })
}

export function useMetricTrend(crewId: string, metric: string, options: TrendOptions = {}) {
  return useQuery({
    queryKey: onboardKeys.trend(crewId, metric, options),
    queryFn: () => onboardApi.getTrend(crewId, metric, options),
    refetchInterval: LIVE_REFRESH_MS,
  })
}

export function useCrewAlerts(crewId: string) {
  return useQuery({
    queryKey: onboardKeys.alerts(crewId),
    queryFn: () => onboardApi.getAlerts(crewId),
    refetchInterval: ALERT_REFRESH_MS,
  })
}

/** After any submission the member's metrics and trends may change, so they are refetched. */
function useMemberMutation<TInput, TResult>(crewId: string, submit: (crewId: string, input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => submit(crewId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: onboardKeys.member(crewId) }),
  })
}

export const useSubmitDailyCheckin = (crewId: string) => useMemberMutation(crewId, onboardApi.submitDailyCheckin)
export const useSubmitPhq4 = (crewId: string) => useMemberMutation(crewId, onboardApi.submitPhq4)
export const useSubmitTeamClimate = (crewId: string) => useMemberMutation(crewId, onboardApi.submitTeamClimate)
export const useSubmitManualEntries = (crewId: string) => useMemberMutation(crewId, onboardApi.submitManualEntries)
