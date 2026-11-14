import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { createQueryClient } from '@/lib/query-client'
import { routes } from '@/routes'
import { mockServer, startMockServer } from '@/test/mock-server'

startMockServer()

function renderAt(path: string) {
  render(
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </QueryClientProvider>,
  )
}

describe('routes', () => {
  beforeEach(() => {
    // The layout checks both backends on every page.
    mockServer.use(
      http.get('*/api/onboard/health', () => HttpResponse.json({ service: 'onboard', status: 'ok' })),
      http.get('*/api/earth/health', () => new HttpResponse(null, { status: 503 })),
    )
  })

  it('lists the 4 crew members from the Crew API on /', async () => {
    renderAt('/')
    expect(await screen.findAllByRole('link', { name: /Commander|Pilot|Specialist|Engineer/ })).toHaveLength(4)
  })

  it('shows an error with a retry button when the crew cannot load', async () => {
    mockServer.use(http.get('*/api/onboard/v1/crew', () => new HttpResponse(null, { status: 500 })))
    renderAt('/')
    expect(await screen.findByText('Could not load the crew')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows the selected astronaut on /crew/:crewId', async () => {
    renderAt('/crew/crew-2')
    expect(await screen.findByRole('heading', { name: 'Kenji Mori' })).toBeInTheDocument()
  })

  it('says so when the crew member does not exist', async () => {
    renderAt('/crew/crew-9')
    expect(await screen.findByRole('heading', { name: 'Unknown crew member' })).toBeInTheDocument()
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
