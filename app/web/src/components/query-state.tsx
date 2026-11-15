import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Placeholder while a query loads. Example: `<LoadingBlock className="h-64" />` */
export function LoadingBlock({ className }: { className?: string }) {
  return <Skeleton aria-label="Loading" className={cn('h-24 w-full', className)} />
}

interface QueryErrorProps {
  error: Error
  title?: string
  onRetry?: () => void
}

/** Error box for a failed query or submission, with an optional retry button. */
export function QueryError({ error, title = 'Could not load data', onRetry }: QueryErrorProps) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
