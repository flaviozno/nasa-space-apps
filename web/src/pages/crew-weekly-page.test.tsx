import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

async function choose(question: string, option: string) {
  const group = await screen.findByRole('radiogroup', { name: question })
  fireEvent.click(within(group).getByRole('radio', { name: new RegExp(option) }))
}

describe('weekly questionnaires', () => {
  it('lists both questionnaires as due and badges the rail', async () => {
    renderAt('/crew/crew-1/weekly')
    expect(await screen.findByRole('link', { name: /Wellbeing \(PHQ-4\).*Due now/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Team climate.*Due now/ })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Crew Hub sections' })).getByRole('link', { name: /Weekly/ })).toHaveTextContent('Due')
  })

  it('answers the PHQ-4 one question at a time and sends the 4 answers in order', async () => {
    let sent: unknown
    mockServer.use(
      http.post('*/api/onboard/v1/crew/:crewId/questionnaires/phq4', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(
          { responseId: 'r', crewId: 'crew-1', questionnaire: 'phq4', submittedAt: Date.now(), total: 3, observationsCreated: 1 },
          { status: 201 },
        )
      }),
    )
    renderAt('/crew/crew-1/weekly/phq4')
    await choose('Feeling nervous, anxious or on edge', 'Several days')
    await choose('Not being able to stop or control worrying', 'More than half the days')
    await choose('Feeling down, depressed or hopeless', 'Not at all')
    await choose('Little interest or pleasure in doing things', 'Not at all')

    expect(await screen.findByRole('button', { name: 'Edit Not being able to stop or control worrying' })).toHaveTextContent(
      'More than half the days',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save answers' }))
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument()
    expect(sent).toEqual({ answers: [1, 2, 0, 0] })
  })

  it('saves team climate and then shows it as done until next week', async () => {
    renderAt('/crew/crew-1/weekly/team-climate')
    await choose('How would you rate the team climate this week?', '^8$')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Team climate 8 of 10 saved.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Back to weekly' }))
    expect(await screen.findByRole('link', { name: /Team climate.*Done · opens again on/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Wellbeing \(PHQ-4\).*Due now/ })).toBeInTheDocument()
  })

  it('shows the closed screen for a questionnaire answered this week', async () => {
    const open = { lastSubmittedAt: null, availableAgainAt: null }
    mockServer.use(
      http.get('*/api/onboard/v1/crew/:crewId/questionnaires/status', () =>
        HttpResponse.json({
          dailyCheckin: open,
          phq4: { lastSubmittedAt: Date.now() - 3_600_000, availableAgainAt: Date.now() + 6 * 86_400_000 },
          teamClimate: open,
        }),
      ),
    )
    renderAt('/crew/crew-1/weekly/phq4')
    expect(await screen.findByRole('heading', { name: 'Wellbeing questionnaire done' })).toBeInTheDocument()
    expect(screen.getByText(/It opens again on .* GMT — in 6 d/)).toBeInTheDocument()
  })
})
