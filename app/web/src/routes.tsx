import type { RouteObject } from 'react-router'
import { AppLayout } from '@/components/app-layout'
import { CrewCheckinPage } from '@/pages/crew-checkin-page'
import { CrewHubPage } from '@/pages/crew-hub-page'
import { CrewManualPage } from '@/pages/crew-manual-page'
import { CrewOverviewPage } from '@/pages/crew-overview-page'
import { CrewPhq4Page } from '@/pages/crew-phq4-page'
import { CrewSelectPage } from '@/pages/crew-select-page'
import { CrewTeamClimatePage } from '@/pages/crew-team-climate-page'
import { CrewWeeklyPage } from '@/pages/crew-weekly-page'
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
          { path: 'weekly', element: <CrewWeeklyPage /> },
          { path: 'weekly/phq4', element: <CrewPhq4Page /> },
          { path: 'weekly/team-climate', element: <CrewTeamClimatePage /> },
          { path: 'manual', element: <CrewManualPage /> },
        ],
      },
      { path: '/earth', element: <EarthViewPage /> },
    ],
  },
]
