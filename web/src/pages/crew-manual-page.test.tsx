import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

const card = (title: string) => within(screen.getByRole('group', { name: title }))

describe('manual measurements', () => {
  it('starts at the last value, adjusts with + and sends only what was included', async () => {
    let sent: unknown
    mockServer.use(
      http.post('*/api/onboard/v1/crew/:crewId/manual-entries', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(
          {
            accepted: [{ id: 'o1', crewId: 'crew-1', metric: 'body_mass', value: 62.8, unit: 'kg', source: 'manual', sourceRef: 'm', takenAt: Date.now() }],
            duplicates: 0,
          },
          { status: 201 },
        )
      }),
    )
    renderAt('/crew/crew-1/manual')
    await screen.findByRole('group', { name: 'Body mass' })
    expect(card('Body mass').getByRole('status', { name: 'Body mass' })).toHaveTextContent('61.8')
    expect(screen.getByRole('button', { name: 'Include a measurement' })).toBeDisabled()

    fireEvent.click(card('Body mass').getByRole('button', { name: 'Body mass +1 kg' }))
    expect(card('Body mass').getByRole('status', { name: 'Body mass' })).toHaveTextContent('62.8')
    expect(card('Body mass').getByRole('button', { name: 'Included' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Save 1 value' }))
    expect(await screen.findByRole('heading', { name: 'Measurements saved' })).toBeInTheDocument()
    expect(screen.getByText('Body mass: 62.8 kg')).toBeInTheDocument()
    expect(sent).toEqual({ entries: [{ metric: 'body_mass', value: 62.8 }] })
  })

  it('sends both blood pressure values together', async () => {
    let sent: { entries: { metric: string }[] } | undefined
    mockServer.use(
      http.post('*/api/onboard/v1/crew/:crewId/manual-entries', async ({ request }) => {
        sent = (await request.json()) as typeof sent
        return HttpResponse.json({ accepted: [], duplicates: 0 }, { status: 201 })
      }),
    )
    renderAt('/crew/crew-1/manual')
    await screen.findByRole('group', { name: 'Blood pressure' })
    fireEvent.click(card('Blood pressure').getByRole('button', { name: 'Include' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 values' }))
    await screen.findByRole('heading', { name: 'Measurements saved' })
    expect(sent?.entries.map((e) => e.metric)).toEqual(['blood_pressure_systolic', 'blood_pressure_diastolic'])
  })

  it('blocks saving when diastolic is not below systolic', async () => {
    renderAt('/crew/crew-1/manual')
    await screen.findByRole('group', { name: 'Blood pressure' })
    const raiseDiastolic = card('Blood pressure').getByRole('button', { name: 'Diastolic +5 mmHg' })
    for (let i = 0; i < 9; i += 1) fireEvent.click(raiseDiastolic)
    expect(card('Blood pressure').getByRole('alert')).toHaveTextContent('Diastolic must be lower than systolic.')
    expect(screen.getByRole('button', { name: /Save 2 values/ })).toBeDisabled()
  })
})
