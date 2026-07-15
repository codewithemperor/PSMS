"use client"

import { useEffect, type ReactNode } from "react"
import { SessionProvider, useSession } from "next-auth/react"
import { useAuthStore } from "@/stores/auth-store"
import { Skeleton } from "@/components/ui/skeleton"

function SessionSync({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    if (status === "loading") {
      setLoading(true)
      return
    }
    if (session?.user) {
      setUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      })
    } else {
      setLoading(false)
    }
  }, [session, status, setUser, setLoading])

  // While the session is being checked on authenticated routes, show a
  // lightweight skeleton so the shell never flashes unauthenticated content.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md space-y-4 p-8">
          <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
          <Skeleton className="h-6 w-32 mx-auto" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionSync>{children}</SessionSync>
    </SessionProvider>
  )
}
