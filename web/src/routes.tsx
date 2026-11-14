import type { RouteObject } from 'react-router'
import { AppLayout } from '@/components/app-layout'
import { CrewCheckinPage } from '@/pages/crew-checkin-page'
import { CrewHubPage } from '@/pages/crew-hub-page'
import { CrewOverviewPage } from '@/pages/crew-overview-page'
import { CrewSectionPlaceholder } from '@/pages/crew-section-placeholder'
import { CrewSelectPage } from '@/pages/crew-select-page'
import { EarthViewPage } from '@/pages/earth-view-page'

// Shared by the browser router (main.tsx) and the memory router in tests.
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <CrewSelectPage /> },
      {
        path: '/crew/:crewId',
        element: <CrewHubPage />,
        children: [
          { index: true, element: <CrewOverviewPage /> },
          { path: 'checkin', element: <CrewCheckinPage /> },
          { path: 'weekly', element: <CrewSectionPlaceholder title="Weekly questionnaires" /> },
          { path: 'manual', element: <CrewSectionPlaceholder title="Manual measurements" /> },
        ],
      },
      { path: '/earth', element: <EarthViewPage /> },
    ],
  },
]
