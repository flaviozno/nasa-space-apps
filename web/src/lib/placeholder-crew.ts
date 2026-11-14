// Placeholder until the Crew API exists: replace with `GET /api/onboard/v1/crew`.
// IDs and names mirror contracts/crew.json.

export interface CrewSummary {
  crewId: string
  name: string
  role: string
}

export const PLACEHOLDER_CREW: CrewSummary[] = [
  { crewId: 'crew-1', name: 'Ana Ribeiro', role: 'Commander' },
  { crewId: 'crew-2', name: 'Kenji Mori', role: 'Pilot' },
  { crewId: 'crew-3', name: 'Lucas Ferreira', role: 'Mission Specialist' },
  { crewId: 'crew-4', name: 'Amara Okafor', role: 'Flight Engineer' },
]
