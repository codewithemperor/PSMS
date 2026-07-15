"use client"

import { create } from "zustand"
import { useEffect } from "react"

interface AppConfig {
  appName: string
  appShortName: string
  logoUrl: string | null
}

interface AppConfigState {
  config: AppConfig
  loaded: boolean
  setConfig: (config: AppConfig) => void
}

/**
 * Default values match the Prisma schema defaults for SystemConfig so the
 * UI renders correctly before the public endpoint responds (e.g. during the
 * very first paint of the login page).
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: "PSMS — Project Supervision Management System",
  appShortName: "PSMS",
  logoUrl: null,
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  config: DEFAULT_APP_CONFIG,
  loaded: false,
  setConfig: (config) => set({ config, loaded: true }),
}))

/**
 * useAppConfig — fetches the public app identity (appName, appShortName,
 * logoUrl) once on mount and caches it in a zustand store. Components
 * subscribe to the store so every consumer (sidebar, header, footer,
 * login page, document title) re-renders automatically when the admin
 * saves a new identity in Settings.
 *
 * Safe to call from any component (including the login page, which has no
 * authenticated session). The endpoint is intentionally public.
 */
export function useAppConfig(): AppConfig {
  const config = useAppConfigStore((s) => s.config)
  const loaded = useAppConfigStore((s) => s.loaded)
  const setConfig = useAppConfigStore((s) => s.setConfig)

  useEffect(() => {
    if (loaded) return
    let cancelled = false
    fetch("/api/system-config/public")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.success) return
        setConfig({
          appName: json.data.appName ?? DEFAULT_APP_CONFIG.appName,
          appShortName: json.data.appShortName ?? DEFAULT_APP_CONFIG.appShortName,
          logoUrl: json.data.logoUrl ?? null,
        })
      })
      .catch(() => {
        // keep defaults on error
      })
    return () => {
      cancelled = true
    }
  }, [loaded, setConfig])

  return config
}

/**
 * invalidateAppConfig — call after the admin saves a new identity in
 * Settings so the next render re-fetches the public endpoint.
 */
export function invalidateAppConfig() {
  useAppConfigStore.setState({ loaded: false })
}
