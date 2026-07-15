import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Realtime chat facade — a drop-in replacement for the old Socket.IO client
 * singleton, backed by Supabase Realtime Broadcast.
 *
 * Why a facade? Every chat component (`chat-window`, `chat-list`, the
 * `useSocket` hook) already talks to a `socket` singleton with a small,
 * stable surface: `.connected`, `.on/.off`, `.connect()`, and `.emit()`.
 * Re-implementing that surface here means the UI logic — which is subtle
 * (optimistic temp ids, typing debounce, read receipts) — stays unchanged;
 * only the transport underneath swaps from Socket.IO to Supabase.
 *
 * Event contract (unchanged from the old Socket.IO mini-service):
 *   IN (this.emit, from the app):
 *     authenticate { userId }              → subscribe to the user's channel
 *     send_message { receiverId, content } → persist via POST /api/messages,
 *                                            then emit `message_sent` locally
 *     mark_messages_read { senderId }      → mark read via GET /api/messages
 *                                            (which also publishes to partner)
 *     typing { receiverId }                → broadcast `user_typing` to partner
 *     stop_typing { receiverId }           → broadcast `user_stopped_typing`
 *   OUT (this.on, delivered to the app):
 *     receive_message, message_sent, messages_read, user_typing,
 *     user_stopped_typing, connect, disconnect
 *
 * Persistence ALWAYS goes through the HTTP API (Vercel can't host a socket
 * server). Realtime is push-only and best-effort: if Supabase is unreachable,
 * messages still send/receive via HTTP + the TanStack Query polling fallback.
 */

type Handler = (payload: unknown) => void

function userChannel(userId: string): string {
  return `user-${userId}`
}

class RealtimeSocket {
  /** True once the user's realtime channel is subscribed. */
  connected = false

  private client: SupabaseClient | null = null
  private userId: string | null = null
  private channel: ReturnType<SupabaseClient["channel"]> | null = null
  private listeners = new Map<string, Set<Handler>>()
  private connectListeners = new Set<Handler>()
  private disconnectListeners = new Set<Handler>()

  // ── EventEmitter surface (socket.io-compatible subset) ──────────────────
  on(event: string, handler: Handler): void {
    if (event === "connect") {
      this.connectListeners.add(handler)
      return
    }
    if (event === "disconnect") {
      this.disconnectListeners.add(handler)
      return
    }
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler)
  }

  off(event: string, handler: Handler): void {
    if (event === "connect") {
      this.connectListeners.delete(handler)
      return
    }
    if (event === "disconnect") {
      this.disconnectListeners.delete(handler)
      return
    }
    this.listeners.get(event)?.delete(handler)
  }

  private emitLocal(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((h) => {
      try {
        h(payload)
      } catch (err) {
        console.error(`[realtime] listener for "${event}" threw:`, err)
      }
    })
  }

  private setConnected(value: boolean): void {
    if (this.connected === value) return
    this.connected = value
    ;(value ? this.connectListeners : this.disconnectListeners).forEach((h) => {
      try {
        h(undefined)
      } catch {
        // listener errors are non-fatal
      }
    })
  }

  // ── Connection lifecycle ────────────────────────────────────────────────
  /**
   * Create the Supabase client (inert until we subscribe). Called from the
   * `useSocket` hook's effect, i.e. client-side only — so reading
   * NEXT_PUBLIC_* env here is safe.
   */
  connect(): void {
    if (this.client) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      console.warn(
        "[realtime] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — chat will fall back to HTTP polling.",
      )
      return
    }
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  disconnect(): void {
    if (this.channel && this.client) {
      this.client.removeChannel(this.channel)
      this.channel = null
    }
    this.setConnected(false)
  }

  // ── The app → server direction (this.emit) ──────────────────────────────
  emit(event: string, payload?: unknown): void {
    switch (event) {
      case "authenticate":
        this.handleAuthenticate((payload as { userId: string }) ?? { userId: "" })
        return
      case "send_message":
        // Persistence happens over HTTP; on success we emit `message_sent`
        // locally so the sender's optimistic bubble is reconciled, exactly as
        // the old socket-service round-trip did.
        void this.handleSend((payload as { receiverId: string; content: string }) ?? {
          receiverId: "",
          content: "",
        })
        return
      case "mark_messages_read":
        // Re-use the GET endpoint's mark-read side effect (it also publishes
        // `messages_read` to the partner). Fire-and-forget.
        void this.handleMarkRead(
          (payload as { senderId: string }) ?? { senderId: "" },
        )
        return
      case "typing":
        this.broadcast(
          ((payload as { receiverId: string }) ?? { receiverId: "" }).receiverId,
          "user_typing",
          { senderId: this.userId },
        )
        return
      case "stop_typing":
        this.broadcast(
          ((payload as { receiverId: string }) ?? { receiverId: "" }).receiverId,
          "user_stopped_typing",
          { senderId: this.userId },
        )
        return
      default:
        // Unknown events are ignored (the old socket silently ignored them too).
        return
    }
  }

  // ── Internal handlers ───────────────────────────────────────────────────
  private handleAuthenticate({ userId }: { userId: string }): void {
    if (!userId || !this.client) return
    this.userId = userId
    // Re-subscribe if already subscribed (e.g. reconnect after a user change).
    if (this.channel) {
      this.client.removeChannel(this.channel)
      this.channel = null
    }
    this.channel = this.client
      .channel(userChannel(userId))
      .on("broadcast", { event: "receive_message" }, (msg) =>
        this.emitLocal("receive_message", (msg as { payload: unknown }).payload),
      )
      .on("broadcast", { event: "messages_read" }, (msg) =>
        this.emitLocal("messages_read", (msg as { payload: unknown }).payload),
      )
      .on("broadcast", { event: "user_typing" }, (msg) =>
        this.emitLocal("user_typing", (msg as { payload: unknown }).payload),
      )
      .on("broadcast", { event: "user_stopped_typing" }, (msg) =>
        this.emitLocal(
          "user_stopped_typing",
          (msg as { payload: unknown }).payload,
        ),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.setConnected(true)
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          this.setConnected(false)
        }
      })
  }

  private async handleSend({
    receiverId,
    content,
  }: {
    receiverId: string
    content: string
  }): Promise<void> {
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ receiverId, content }),
      })
      const json = (await res.json()) as {
        data?: {
          id: string
          content: string
          receiverId: string
          createdAt: string
          isRead: boolean
        }
      }
      if (res.ok && json.data) {
        const saved = json.data
        // Reconcile the sender's optimistic temp bubble (matched by content
        // in chat-window's handleMessageSent) and refresh their conversation
        // list (chat-list listens for message_sent).
        this.emitLocal("message_sent", {
          id: saved.id,
          content: saved.content,
          receiverId: saved.receiverId,
          createdAt: saved.createdAt,
          isRead: saved.isRead,
        })
      }
    } catch (err) {
      console.error("[realtime] send_message POST failed:", err)
      // Leave the optimistic bubble marked pending; the user can retry.
    }
  }

  private async handleMarkRead({ senderId }: { senderId: string }): Promise<void> {
    try {
      // The GET route marks messages from this partner as read AND publishes
      // `messages_read` to them. We ignore the body — local state is already
      // correct.
      await fetch(`/api/messages?userId=${encodeURIComponent(senderId)}`, {
        credentials: "include",
      })
    } catch (err) {
      console.error("[realtime] mark_messages_read failed:", err)
    }
  }

  /** Peer-to-peer broadcast to another user's channel (typing indicators). */
  private broadcast(
    receiverId: string,
    event: "user_typing" | "user_stopped_typing",
    payload: unknown,
  ): void {
    if (!this.client || !receiverId) return
    try {
      void this.client.channel(userChannel(receiverId)).send({
        type: "broadcast",
        event,
        payload,
      })
    } catch (err) {
      console.error(`[realtime] broadcast ${event} failed:`, err)
    }
  }
}

/**
 * Singleton — one realtime client per browser tab, mirroring the old socket
 * singleton's lifetime semantics.
 */
const socket = new RealtimeSocket()
export default socket
