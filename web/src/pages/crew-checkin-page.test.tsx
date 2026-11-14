import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

async function pick(question: string, value: string) {
  const group = await screen.findByRole('radiogroup', { name: question })
  fireEvent.click(within(group).getByRole('radio', { name: value }))
}

async function answerFeelings() {
  await pick('How is your mood today?', '7')
  await pick('How stressed do you feel?', '4')
  await pick('How tired do you feel?', '3')
  await pick('How sleepy are you right now?', '2')
  await screen.findByRole('heading', { name: 'Any symptoms today?' })
}

describe('daily check-in', () => {
  it('walks through every question and saves the answers', async () => {
    let sent: unknown
    mockServer.use(
      http.post('*/api/onboard/v1/crew/:crewId/questionnaires/daily-checkin', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(
          { responseId: 'r1', crewId: 'crew-1', questionnaire: 'daily_checkin', submittedAt: Date.now(), total: null, observationsCreated: 10 },
          { status: 201 },
        )
      }),
    )
    renderAt('/crew/crew-1/checkin')
    expect(await screen.findByText('Step 1 of 6')).toBeInTheDocument()

    await answerFeelings()
    await pick('Headache', '3')
    fireEvent.click(screen.getByRole('button', { name: /Review/ }))

    expect(await screen.findByRole('button', { name: 'Edit Headache' })).toHaveTextContent('3')
    fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }))

    expect(await screen.findByRole('heading', { name: 'Check-in saved' })).toBeInTheDocument()
    expect(sent).toEqual({
      mood: 7,
      stress: 4,
      fatigue: 3,
      sleepiness: 2,
      symptomHeadache: 3,
      symptomBackPain: 0,
      symptomCongestion: 0,
      symptomEyeIrritation: 0,
      symptomSkin: 0,
      symptomNausea: 0,
    })
  })

  it('keeps the answer when going back', async () => {
    renderAt('/crew/crew-1/checkin')
    await pick('How is your mood today?', '8')
    await screen.findByRole('heading', { name: 'How stressed do you feel?' })
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    const mood = await screen.findByRole('radiogroup', { name: 'How is your mood today?' })
    expect(within(mood).getByRole('radio', { name: '8' })).toHaveAttribute('aria-checked', 'true')
  })

  it('jumps back to a question from the review screen', async () => {
    renderAt('/crew/crew-1/checkin')
    await answerFeelings()
    fireEvent.click(screen.getByRole('button', { name: /Review/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit How tired do you feel?' }))
    expect(await screen.findByRole('heading', { name: 'How tired do you feel?' })).toBeInTheDocument()
  })

  it('shows the API validation error and keeps the answers', async () => {
    mockServer.use(
      http.post('*/api/onboard/v1/crew/:crewId/questionnaires/daily-checkin', () =>
        HttpResponse.json({ detail: [{ loc: ['body', 'mood'], msg: 'Input should be less than or equal to 10' }] }, { status: 422 }),
      ),
    )
    renderAt('/crew/crew-1/checkin')
    await answerFeelings()
    fireEvent.click(screen.getByRole('button', { name: /Review/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save check-in' }))
    expect(await screen.findByText('Could not save the check-in')).toBeInTheDocument()
    expect(screen.getByText('mood: Input should be less than or equal to 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit How is your mood today?' })).toHaveTextContent('7')
  })
})
