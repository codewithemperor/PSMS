"use client"

import { usePathname } from "next/navigation"
import { useAppConfig } from "@/stores/app-config-store"

export function Footer() {
  const pathname = usePathname()
  const { appName, appShortName } = useAppConfig()

  // Hide the footer on messaging pages — the chat UI takes full viewport height
  // and a footer below it would create an awkward gap / unnecessary scroll.
  if (pathname?.includes("/messages")) {
    return null
  }

  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-slate-200/60 bg-white px-6 py-3">
      <p className="text-center text-xs text-slate-400">
        © {year} {appShortName} — {appName}
      </p>
    </footer>
  )
}
