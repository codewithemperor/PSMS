"use client"

import { useEffect } from "react"
import { useAppConfig } from "@/stores/app-config-store"

interface DynamicTitleProps {
  /** Optional page-specific suffix (e.g. "Dashboard"). Renders as "Dashboard · {appShortName}". */
  suffix?: string
}

/**
 * DynamicTitle — keeps the browser tab title in sync with the configured
 * app name. When an admin changes the app name/short name in Settings,
 * every page that renders this component updates its title automatically.
 *
 * Usage: drop `<DynamicTitle suffix="Dashboard" />` near the top of any
 * page. If `suffix` is omitted, the title is just the configured app name.
 */
export function DynamicTitle({ suffix }: DynamicTitleProps) {
  const { appName, appShortName } = useAppConfig()

  useEffect(() => {
    if (suffix) {
      document.title = `${suffix} · ${appShortName}`
    } else {
      document.title = appName
    }
  }, [appName, appShortName, suffix])

  return null
}
