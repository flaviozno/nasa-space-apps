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
    expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
    expect(screen.getByRole('region', { name: 'Crew content' })).toHaveClass('crew-content-scroll', 'overflow-y-auto')
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

  it('summarizes the operational state before the detailed vitals', async () => {
    renderAt('/crew/crew-1')
    const summary = await screen.findByRole('region', { name: 'Operational summary' })
    expect(summary).toHaveTextContent('MISSION SNAPSHOT')
    expect(summary).toHaveTextContent('MONITOR')
    expect(summary).toHaveTextContent('Daily check-in')
    expect(summary).toHaveTextContent('Due now')
    expect(summary).toHaveTextContent('0 active')
    expect(summary).toHaveTextContent('Data link')
    expect(summary).toHaveTextContent('Connected')
  })

  it('puts a local, non-clinical action plan before the operational summary', async () => {
    renderAt('/crew/crew-3')
    const plan = await screen.findByRole('region', { name: 'What to do now' })
    expect(plan).toHaveTextContent('ACT NOW')
    expect(plan).toHaveTextContent('Pause before a critical task')
    expect(plan).toHaveTextContent('Confirm the heart-rate reading')
    expect(plan).toHaveTextContent('Use the approved onboard procedure')
    expect(plan).toHaveTextContent('does not diagnose, prescribe')
    expect(within(plan).getByRole('link', { name: 'Open health check-in' })).toHaveAttribute('href', '/crew/crew-3/checkin')
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
    expect(alerts).toHaveTextContent('High heart rate — 125 bpm')
    expect(alerts).toHaveTextContent('5.0σ above your baseline')
    expect(alerts).not.toHaveTextContent('_')
    expect(vitals().getByRole('button', { name: /Heart rate/ })).toHaveTextContent('Deviation')
  })

  it('explains the local mission-readiness recommendation without claiming a personal dose', async () => {
    renderAt('/crew/crew-3')
    const readiness = await screen.findByRole('region', { name: 'Mission Readiness' })
    expect(readiness).toHaveTextContent('REVIEW BEFORE CRITICAL TASK')
    fireEvent.click(within(readiness).getByRole('button', { name: 'Why am I seeing this?' }))
    expect(readiness).toHaveTextContent('Historical ISS DosTel dose-rate reference')
    expect(readiness).toHaveTextContent('not a personal radiation dose or medical diagnosis')
  })

  it('shows an error box when the metrics cannot load', async () => {
    mockServer.use(http.get('*/api/onboard/v1/crew/:crewId/metrics', () => new HttpResponse(null, { status: 500 })))
    renderAt('/crew/crew-1')
    expect(await screen.findByText('Could not load your metrics')).toBeInTheDocument()
  })

  it('navigates between hub sections with the rail', async () => {
    renderAt('/crew/crew-1')
    const rail = await screen.findByRole('navigation', { name: 'Crew Hub sections' })
    const crewHeader = screen.getByRole('heading', { name: 'Ana Ribeiro' })
    fireEvent.click(within(rail).getByRole('link', { name: /Check-in/ }))
    expect(await screen.findByRole('heading', { name: 'Daily check-in' })).toBeInTheDocument()
    // The Crew Hub shell is intentionally persistent: only its nested content
    // changes, so the astronaut identity and its cached queries do not reload.
    expect(screen.getByRole('heading', { name: 'Ana Ribeiro' })).toBe(crewHeader)
  })
})
