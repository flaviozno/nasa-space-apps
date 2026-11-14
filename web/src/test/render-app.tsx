import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createQueryClient } from '@/lib/query-client'
import { routes } from '@/routes'
import { mockServer } from '@/test/mock-server'

/** Render the whole app at `path`, backed by the MSW mocks (call `startMockServer()` in the file). */
export function renderAt(path: string) {
  // The layout checks both backends on every page: onboard answers, Earth is down.
  mockServer.use(
    http.get('*/api/onboard/health', () => HttpResponse.json({ service: 'onboard', status: 'ok' })),
    http.get('*/api/earth/health', () => new HttpResponse(null, { status: 503 })),
  )
  return render(
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </QueryClientProvider>,
  )
}
