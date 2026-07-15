"use client"

import { type ReactNode } from "react"
import { useSocket } from "@/hooks/use-socket"

/**
 * Client-only wrapper that keeps the Socket.IO connection alive across all
 * pages within a role-scoped layout.
 *
 * The role layouts (admin/supervisor/student/layout.tsx) are async server
 * components — they can't call `useSocket()` directly. Instead they wrap
 * `{children}` in this provider so the hook runs once per role section.
 *
 * Renders nothing visible.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  useSocket()
  return <>{children}</>
}
