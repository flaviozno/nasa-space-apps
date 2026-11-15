import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { AppStartup } from '@/components/app-startup'
import { Toaster } from '@/components/ui/sonner'
import { createQueryClient } from '@/lib/query-client'
import { routes } from '@/routes'

// `npm run dev:mock` answers the onboard Crew API with MSW (src/mocks); requests without a
// mock (health checks, Earth) still go to the dev proxy. Never active in production builds.
let mockWorkerStart: Promise<void> | undefined

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS !== 'true') return
  mockWorkerStart ??= import('./mocks/browser').then(async ({ worker }) => {
    await worker.start({ onUnhandledFrame: 'bypass' })
  })
  await mockWorkerStart
}

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStartup initialize={enableMocking}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={createBrowserRouter(routes)} />
        <Toaster />
      </QueryClientProvider>
    </AppStartup>
  </StrictMode>,
)
