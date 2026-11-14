import { useParams } from 'react-router'
import { PLACEHOLDER_CREW } from '@/lib/placeholder-crew'

/** `/crew/:crewId` — Crew Hub (owner: Wallace): levels, trends, alerts, questionnaires, manual entries. */
export function CrewHubPage() {
  const { crewId } = useParams()
  const member = PLACEHOLDER_CREW.find((candidate) => candidate.crewId === crewId)

  if (member === undefined) return <p>Unknown crew member: {crewId}</p>
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{member.name}</h1>
      <p className="text-muted-foreground">Crew Hub — metrics, trends and check-in will appear here.</p>
    </section>
  )
}
