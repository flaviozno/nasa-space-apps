import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'

const MIN_SPLASH_MS = 760

interface AppStartupProps {
  children: ReactNode
  initialize: () => Promise<void>
}

/**
 * A short, quiet boot sequence before the operational UI mounts. It gives the
 * mock worker time to start in development and establishes the CORA mark once,
 * rather than repeating it inside individual pages.
 */
export function AppStartup({ children, initialize }: AppStartupProps) {
  const [showSplash, setShowSplash] = useState(true)
  const [appMounted, setAppMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    const startedAt = performance.now()

    void initialize()
      .catch((error: unknown) => {
        // A failed demo mock must not prevent the real API or production app from opening.
        console.error('Could not start the mock worker.', error)
      })
      .finally(() => {
        const remaining = Math.max(0, MIN_SPLASH_MS - (performance.now() - startedAt))
        window.setTimeout(() => {
          if (!cancelled) setShowSplash(false)
        }, remaining)
      })

    return () => {
      cancelled = true
    }
  }, [initialize])

  return (
    <>
      <AnimatePresence initial={false} mode="wait" onExitComplete={() => setAppMounted(true)}>
        {showSplash && <StartupScreen />}
      </AnimatePresence>
      {appMounted && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {children}
        </motion.div>
      )}
    </>
  )
}

function StartupScreen() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      key="cora-startup"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.985, transition: { duration: reduceMotion ? 0 : 0.26, ease: 'easeInOut' } }}
      className="fixed inset-0 z-50 grid place-items-center bg-background"
      aria-label="Starting CORA"
      role="status"
    >
      <div className="flex flex-col items-center gap-5">
        <motion.img
          src="/cora-mark.svg"
          alt="CORA"
          className="size-15"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -3, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: 'easeOut', y: { delay: 0.7, duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
        />
        <div className="h-px w-20 overflow-hidden bg-primary/20">
          <motion.span
            className="block h-full bg-primary"
            initial={{ x: '-100%' }}
            animate={reduceMotion ? { x: 0 } : { x: ['-100%', '100%'] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.15, delay: 0.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <p className="text-[10px] font-bold tracking-[0.24em] text-muted-foreground">LOCAL READINESS</p>
      </div>
    </motion.div>
  )
}
