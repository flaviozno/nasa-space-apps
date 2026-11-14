import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { fetchServiceHealth, type HealthFetcher, type ServiceHealth } from '@/lib/api'

interface ServiceStatusProps {
  label: string
  baseUrl: string
  fetcher?: HealthFetcher
}

/** Badge showing whether one backend answers `/health`. Example: `<ServiceStatus label="Onboard" baseUrl={ONBOARD_API} />` */
export function ServiceStatus({ label, baseUrl, fetcher }: ServiceStatusProps) {
  const [health, setHealth] = useState<ServiceHealth | null>(null)

  useEffect(() => {
    let active = true
    fetchServiceHealth(baseUrl, fetcher).then((result) => active && setHealth(result))
    return () => {
      active = false
    }
  }, [baseUrl, fetcher])

  if (health === null) return <Badge variant="outline">{label}: checking…</Badge>
  if (health.state === 'ok') return <Badge>{label}: online</Badge>
  return <Badge variant="destructive" title={health.detail}>{label}: offline</Badge>
}
