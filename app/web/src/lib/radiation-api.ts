import { ONBOARD_API } from '@/lib/api'
import { requestJson } from '@/lib/http'
import type { RadiationTrack } from '@/lib/radiation-contract'

export const RADIATION_WINDOW_MINUTES = 120

export const radiationApi = {
  /** Station radiation readings of the last `windowMinutes` (see radiation-contract.ts). */
  getTrack: (windowMinutes = RADIATION_WINDOW_MINUTES) =>
    requestJson<RadiationTrack>(`${ONBOARD_API}/v1/environment/radiation?windowMinutes=${windowMinutes}`),
}
