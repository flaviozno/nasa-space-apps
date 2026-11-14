import { CircleCheckIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchServiceHealth, type HealthFetcher, type ServiceHealth } from '@/lib/api'
import { cn } from '@/lib/utils'

const SIZE = 'inline-flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-semibold'

interface ServiceStatusProps {
  label: string
  baseUrl: string
  fetcher?: HealthFetcher
}

/** Health is encoded as a word, icon, and color so it remains understandable without color vision. */
export function ServiceStatus({ label, baseUrl, fetcher }: ServiceStatusProps) {
  const [health, setHealth] = useState<ServiceHealth | null>(null)

  useEffect(() => {
    let active = true
    fetchServiceHealth(baseUrl, fetcher).then((result) => active && setHealth(result))
    return () => {
      active = false
    }
  }, [baseUrl, fetcher])

  if (health === null) {
    return (
      <span className={cn(SIZE, 'border-status-advisory/50 bg-status-advisory/10 text-status-advisory')}>
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
        {label}: checking
      </span>
    )
  }
  if (health.state === 'ok') {
    return (
      <span className={cn(SIZE, 'border-status-ok/50 bg-status-ok/10 text-status-ok')}>
        <CircleCheckIcon className="size-4" aria-hidden="true" />
        <span>{label}: online</span>
        <span className="rounded bg-status-ok/15 px-1.5 py-0.5 text-xs tracking-wide">NOMINAL</span>
      </span>
    )
  }
  return (
    <span className={cn(SIZE, 'border-status-alert/60 bg-status-alert/10 text-status-alert')} title={health.detail}>
      <TriangleAlertIcon className="size-4" aria-hidden="true" />
      {label}: offline
    </span>
  )
}
