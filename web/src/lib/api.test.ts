import { describe, expect, it } from 'vitest'
import { fetchServiceHealth } from '@/lib/api'
import { FakeHealthServer } from '@/test/fake-health-server'

describe('fetchServiceHealth', () => {
  it('reports ok with the service name', async () => {
    const server = new FakeHealthServer().respondOk('/api/onboard/health', 'onboard')
    await expect(fetchServiceHealth('/api/onboard', server.fetch)).resolves.toEqual({ state: 'ok', service: 'onboard' })
    expect(server.requestedUrls).toEqual(['/api/onboard/health'])
  })

  it('reports unreachable on an HTTP error status', async () => {
    const server = new FakeHealthServer().respondStatus('/api/earth/health', 502)
    await expect(fetchServiceHealth('/api/earth', server.fetch)).resolves.toEqual({ state: 'unreachable', detail: 'HTTP 502' })
  })

  it('reports unreachable when the request fails', async () => {
    const server = new FakeHealthServer().failWith('/api/earth/health', new Error('connection refused'))
    await expect(fetchServiceHealth('/api/earth', server.fetch)).resolves.toEqual({ state: 'unreachable', detail: 'connection refused' })
  })
})
