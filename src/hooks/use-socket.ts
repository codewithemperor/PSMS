"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useSession } from "next-auth/react"
import socket from "@/lib/socket"

/**
 * Subscribes to the Socket.IO connection state using `useSyncExternalStore`.
 *
 * This is the React 19-recommended pattern for reading external system state
 * (like a Socket.IO connection) — it avoids `setState`-in-effect lint violations
 * and stays automatically in sync with `socket.connected`.
 */
function subscribe(callback: () => void) {
  socket.on("connect", callback)
  socket.on("disconnect", callback)
  return () => {
    socket.off("connect", callback)
    socket.off("disconnect", callback)
  }
}

function getSnapshot() {
  return socket.connected
}

function getServerSnapshot() {
  return false
}

/**
 * Connects the Socket.IO client as soon as we have an authenticated user id.
 *
 * Reads the user id directly from the NextAuth session via `useSession()` —
 * the single source of truth for the authenticated user.
 *
 * The chat mini-service runs independently on port 3003 (started as a
 * persistent background process). We no longer poke a wake endpoint — the
 * service is always up.
 *
 * - On mount / when `userId` becomes available: connect + emit `authenticate`.
 * - On reconnect: re-emit `authenticate` (the server has no memory of us
 *   across reconnects).
 * - If the socket is ALREADY connected when the effect runs (singleton socket
 *   surviving a remount), authenticate immediately.
 * - On unmount: clean up listeners (but keep the connection alive for other
 *   hook instances — the socket is a singleton).
 *
 * Returns the raw socket + an `isConnected` flag for components that need it
 * (online indicators, typing indicators, etc.).
 */
export function useSocket() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const isConnected = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  useEffect(() => {
    if (!userId) return

    // If the socket is already connected (singleton survived a remount),
    // authenticate immediately. Otherwise, authenticate when `connect` fires.
    function handleConnect() {
      socket.emit("authenticate", { userId })
    }

    socket.on("connect", handleConnect)

    if (!socket.connected) {
      socket.connect()
    } else {
      // Already connected — authenticate now. The `connect` event won't
      // replay for an already-connected socket.
      socket.emit("authenticate", { userId })
    }

    return () => {
      socket.off("connect", handleConnect)
    }
  }, [userId])

  return { socket, isConnected }
}
