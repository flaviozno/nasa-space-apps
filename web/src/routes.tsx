import type { RouteObject } from 'react-router'
import { AppLayout } from '@/components/app-layout'
import { CrewHubPage } from '@/pages/crew-hub-page'
import { CrewSelectPage } from '@/pages/crew-select-page'
import { EarthViewPage } from '@/pages/earth-view-page'

// Shared by the browser router (main.tsx) and the memory router in tests.
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <CrewSelectPage /> },
      { path: '/crew/:crewId', element: <CrewHubPage /> },
      { path: '/earth', element: <EarthViewPage /> },
    ],
  },
]
