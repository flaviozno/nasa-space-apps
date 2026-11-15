import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { RadiationTrack } from '@/lib/radiation-contract'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

function serveTrack(track: Partial<RadiationTrack>) {
  mockServer.use(
    http.get('*/api/onboard/v1/environment/radiation', () =>
      HttpResponse.json({ generatedAtMs: Date.now(), windowMinutes: 120, source: 'Test source', samples: [], ...track }),
    ),
  )
}

describe('RadiationPage', () => {
  it('shows the summary, the map, and the highest regions from the replayed ISS readings', async () => {
    renderAt('/radiation')
    expect(await screen.findByRole('heading', { name: 'Station radiation' })).toBeInTheDocument()
    expect(await screen.findByText('Peak, last 2 h')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /map of radiation dose rate/i })).toBeInTheDocument()
    const regions = screen.getByRole('region', { name: 'Regions by dose rate' })
    expect(within(regions).getAllByRole('button', { pressed: false })).toHaveLength(5)
    expect(screen.getByText(/not a personal dose for any crew member/i)).toBeInTheDocument()
  })

  it('shows the details of a region tapped in the list', async () => {
    renderAt('/radiation')
    const regions = await screen.findByRole('region', { name: 'Regions by dose rate' })
    const [first] = within(regions).getAllByRole('button', { pressed: false })
    fireEvent.click(first)
    const detail = screen.getByRole('region', { name: 'Selected region' })
    expect(within(detail).getByText('Readings')).toBeInTheDocument()
    fireEvent.click(within(detail).getByRole('button', { name: 'Clear selection' }))
    expect(screen.queryByRole('region', { name: 'Selected region' })).not.toBeInTheDocument()
  })

  it('says so when there are no readings', async () => {
    serveTrack({ samples: [] })
    renderAt('/radiation')
    expect(await screen.findByText('No radiation readings in the last 2 hours.')).toBeInTheDocument()
  })

  it('offers a retry when the route fails', async () => {
    mockServer.use(http.get('*/api/onboard/v1/environment/radiation', () => HttpResponse.json({ detail: 'Not Found' }, { status: 404 })))
    renderAt('/radiation')
    expect(await screen.findByText('Could not load radiation readings')).toBeInTheDocument()
  })
})
