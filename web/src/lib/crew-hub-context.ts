import { useOutletContext } from 'react-router'
import type { CrewMember } from '@/lib/onboard-types'

/** What the Crew Hub layout hands to its sections (overview, check-in, weekly, manual). */
export interface CrewHubContext {
  member: CrewMember
}

/** The crew member whose hub is open. Only valid inside a Crew Hub section route. */
export function useCrewHubMember(): CrewMember {
  return useOutletContext<CrewHubContext>().member
}
