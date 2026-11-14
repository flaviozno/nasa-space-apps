import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/routes'
import { FakeHealthServer } from '@/test/fake-health-server'

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('routes', () => {
  beforeEach(() => {
    // The layout checks both backends on every page.
    const server = new FakeHealthServer()
      .respondOk('/api/onboard/health', 'onboard')
      .respondStatus('/api/earth/health', 503)
    vi.stubGlobal('fetch', server.fetch)
  })

  it('lists the 4 crew members on /', () => {
    renderAt('/')
    expect(screen.getAllByRole('link', { name: /Commander|Pilot|Specialist|Engineer/ })).toHaveLength(4)
  })

  it('shows the selected astronaut on /crew/:crewId', () => {
    renderAt('/crew/crew-2')
    expect(screen.getByRole('heading', { name: 'Kenji Mori' })).toBeInTheDocument()
  })

  it('shows the Earth view on /earth', () => {
    renderAt('/earth')
    expect(screen.getByRole('heading', { name: 'Earth view' })).toBeInTheDocument()
  })

  it('shows backend status in the header', async () => {
    renderAt('/')
    expect(await screen.findByText('Onboard: online')).toBeInTheDocument()
    expect(await screen.findByText('Earth: offline')).toBeInTheDocument()
  })
})
