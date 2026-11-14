import { Link } from 'react-router'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PLACEHOLDER_CREW } from '@/lib/placeholder-crew'

/** `/` — astronaut picks themselves (no login in the MVP). */
export function CrewSelectPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Who are you?</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLACEHOLDER_CREW.map((member) => (
          <Link key={member.crewId} to={`/crew/${member.crewId}`}>
            <Card className="transition-colors hover:bg-muted">
              <CardHeader>
                <CardTitle>{member.name}</CardTitle>
                <CardDescription>{member.role}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
