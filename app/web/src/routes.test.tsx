import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockServer, startMockServer } from '@/test/mock-server'
import { renderAt } from '@/test/render-app'

startMockServer()

describe('routes', () => {
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
    expect(screen.getByRole('link', { name: 'Crew' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Earth' })).not.toHaveAttribute('aria-current')
  })

  it('says so when the crew member does not exist', async () => {
    renderAt('/crew/crew-9')
    expect(await screen.findByRole('heading', { name: 'Unknown crew member' })).toBeInTheDocument()
  })

  it('shows the Earth view on /earth', () => {
    renderAt('/earth')
    expect(screen.getByRole('heading', { name: 'Earth view' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Earth' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Crew' })).not.toHaveAttribute('aria-current')
  })

  it('shows backend status in the header', async () => {
    renderAt('/')
    expect(await screen.findByText('Onboard: online')).toBeInTheDocument()
    expect(await screen.findByText('Earth: offline')).toBeInTheDocument()
  })
})
