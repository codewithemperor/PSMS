"use client"

import { GraduationCap } from "lucide-react"
import Image from "next/image"
import { useAppConfig } from "@/stores/app-config-store"
import { cn } from "@/lib/utils"

interface AppBrandingProps {
  /** Tailwind classes for the icon/logo chip (size + bg + text color) */
  className?: string
  /** Show the app short name next to the logo */
  showName?: boolean
  /** Tailwind classes for the short-name text */
  nameClassName?: string
  /** Icon size in pixels (square) */
  size?: number
}

/**
 * AppBranding — renders the current app logo + short name.
 *
 * - If `logoUrl` is set in SystemConfig, renders the image (via next/image).
 * - Otherwise renders a GraduationCap in an emerald chip.
 *
 * Reads from the shared `useAppConfig` store, so it updates automatically
 * when an admin changes the app identity in Settings.
 */
export function AppBranding({
  className,
  showName = true,
  nameClassName,
  size = 36,
}: AppBrandingProps) {
  const { appShortName, logoUrl } = useAppConfig()

  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${appShortName} logo`}
          width={size}
          height={size}
          className={cn("shrink-0 rounded-lg object-cover", className)}
          unoptimized
        />
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm",
            className,
          )}
          style={{ width: size, height: size }}
        >
          <GraduationCap style={{ width: size * 0.55, height: size * 0.55 }} />
        </div>
      )}
      {showName && (
        <span className={cn("text-lg font-bold text-white", nameClassName)}>
          {appShortName}
        </span>
      )}
    </div>
  )
}
