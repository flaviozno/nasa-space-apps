import { WatchIcon } from 'lucide-react'
import { formatDeviceId } from '@/lib/device'
import { cn } from '@/lib/utils'

/** The crew member's wearable as a readable chip: ⌚ Wearable 01. */
export function DeviceChip({ deviceId, className }: { deviceId: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-base font-medium text-muted-foreground',
        className,
      )}
    >
      <WatchIcon className="size-5 text-primary" aria-hidden="true" />
      {formatDeviceId(deviceId)}
    </span>
  )
}
