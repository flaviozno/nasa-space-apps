import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

const vitals = () => within(screen.getByRole('region', { name: 'Current levels' }))

describe('Crew Hub overview', () => {
  it('shows the four live vitals with their status', async () => {
    renderAt('/crew/crew-1')
    await screen.findByRole('region', { name: 'Current levels' })
    for (const label of ['Heart rate', 'SpO₂', 'Body temp', 'Resp. rate']) {
      expect(vitals().getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
    expect(vitals().getAllByText('Normal')).toHaveLength(3)
    // Resp. rate has no readings yet: shown as missing, never as 0.
    expect(vitals().getByRole('button', { name: /Resp\. rate/ })).toHaveTextContent(/No data.*—/)
  })

  it('opens on the heart rate trend with the personal normal range', async () => {
    renderAt('/crew/crew-1')
    const chart = await screen.findByRole('region', { name: 'Heart rate trend' })
    expect(within(chart).getByText('Your normal range (median ± 2σ)')).toBeInTheDocument()
  })

  it('switches the trend when another vital is tapped', async () => {
    renderAt('/crew/crew-1')
    await screen.findByRole('region', { name: 'Current levels' })
    fireEvent.click(vitals().getByRole('button', { name: /SpO₂/ }))
    expect(await screen.findByRole('region', { name: 'SpO₂ trend' })).toBeInTheDocument()
    expect(vitals().getByRole('button', { name: /SpO₂/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows onboard alerts and the deviating vital for crew-3', async () => {
    renderAt('/crew/crew-3')
    const alerts = await screen.findByRole('alert', { name: 'Onboard alerts' })
    expect(alerts).toHaveTextContent('ELEVATED_HEART_RATE')
    expect(vitals().getByRole('button', { name: /Heart rate/ })).toHaveTextContent('Deviation')
  })

  it('shows an error box when the metrics cannot load', async () => {
    mockServer.use(http.get('*/api/onboard/v1/crew/:crewId/metrics', () => new HttpResponse(null, { status: 500 })))
    renderAt('/crew/crew-1')
    expect(await screen.findByText('Could not load your metrics')).toBeInTheDocument()
  })

  it('navigates between hub sections with the rail', async () => {
    renderAt('/crew/crew-1')
    const rail = await screen.findByRole('navigation', { name: 'Crew Hub sections' })
    fireEvent.click(within(rail).getByRole('link', { name: /Check-in/ }))
    expect(await screen.findByRole('heading', { name: 'Daily check-in' })).toBeInTheDocument()
  })
})
