"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"


/**
 * Touch-sized toasts for the tablet: top center (never under the hand), large text and icon,
 * and a colored border + tint per kind so "saved" reads at a glance in a dim cabin.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={20}
      duration={4000}
      icons={{
        success: <CircleCheckIcon className="size-7 text-status-ok" />,
        info: <InfoIcon className="size-7 text-primary" />,
        warning: <TriangleAlertIcon className="size-7 text-status-warn" />,
        error: <OctagonXIcon className="size-7 text-status-alert" />,
        loading: <Loader2Icon className="size-7 animate-spin text-muted-foreground" />,
      }}
      style={{ "--width": "min(32rem, calc(100vw - 2rem))" } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          // Color lives only in the per-kind classes below: two bg-* classes on one element
          // would fight, and the neutral one could win.
          toast:
            "cn-toast flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 px-6 py-5 font-sans text-foreground shadow-2xl shadow-black/60",
          default: "border-border bg-card",
          loading: "border-border bg-card",
          title: "text-xl font-semibold leading-snug",
          description: "text-base text-muted-foreground",
          icon: "flex size-8 shrink-0 items-center justify-center",
          // Status tint mixed into the card color, so the toast stands out from the near-black page.
          // Written out in full: Tailwind only generates class names it finds literally.
          success: "border-status-ok bg-[color-mix(in_oklch,var(--color-status-ok)_22%,var(--card))]",
          error: "border-status-alert bg-[color-mix(in_oklch,var(--color-status-alert)_22%,var(--card))]",
          warning: "border-status-warn bg-[color-mix(in_oklch,var(--color-status-warn)_22%,var(--card))]",
          info: "border-primary bg-[color-mix(in_oklch,var(--color-primary)_22%,var(--card))]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
