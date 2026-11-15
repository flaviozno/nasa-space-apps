// Calls behind the Earth view. The link status/toggle live on onboard (they describe the
// onboard outbox); the synced crew data and alerts come from the Earth service.

import { EARTH_API, ONBOARD_API } from '@/lib/api'
import type { EarthAlert, EarthCrewMember, EarthStatus, SyncStatus } from '@/lib/earth-contract'
import { requestJson } from '@/lib/http'

export const earthApi = {
  getSyncStatus: () => requestJson<SyncStatus>(`${ONBOARD_API}/v1/sync/status`),

  /**
   * Turn the simulated link on or off. The real endpoint requires an admin token that a
   * browser must not hold; how the demo passes it (nginx, demo-only route) is still open.
   */
  setLink: (enabled: boolean) =>
    requestJson<SyncStatus>(`${ONBOARD_API}/v1/sync/link`, { method: 'PUT', body: JSON.stringify({ enabled }) }),

  getEarthStatus: () => requestJson<EarthStatus>(`${EARTH_API}/v1/views/status`),
  getEarthCrew: () => requestJson<EarthCrewMember[]>(`${EARTH_API}/v1/views/crew`),
  getEarthAlerts: () => requestJson<EarthAlert[]>(`${EARTH_API}/v1/views/alerts`),
}
