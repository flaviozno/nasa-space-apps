import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { handlers, resetMockSubmissions } from '@/mocks/handlers'

/** The MSW Crew API mocks as a Node server for tests; add per-test overrides with `mockServer.use(...)`. */
export const mockServer = setupServer(...handlers)

/** Call once at the top of a test file: starts the mock server around its tests. */
export function startMockServer() {
  beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }))
  afterEach(() => {
    mockServer.resetHandlers()
    resetMockSubmissions()
  })
  afterAll(() => mockServer.close())
}
