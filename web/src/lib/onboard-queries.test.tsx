import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { onboardKeys, useCrew, useCrewMetrics, useSubmitTeamClimate } from '@/lib/onboard-queries'
import { createQueryClient } from '@/lib/query-client'
import { startMockServer } from '@/test/mock-server'

startMockServer()

function setup() {
  const client = createQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

describe('onboard query hooks', () => {
  it('loads the crew', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useCrew(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((member) => member.name)).toContain('Amara Okafor')
  })

  it('exposes API errors without retrying 4xx', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useCrewMetrics('crew-9'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('unknown crewId: crew-9')
  })

  it('refetches the member data after a submission', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(onboardKeys.metrics('crew-1'), { crewId: 'crew-1', generatedAt: 0, metrics: [] })
    const { result } = renderHook(() => useSubmitTeamClimate('crew-1'), { wrapper })
    await result.current.mutateAsync({ score: 8 })
    expect(client.getQueryState(onboardKeys.metrics('crew-1'))?.isInvalidated).toBe(true)
  })
})
