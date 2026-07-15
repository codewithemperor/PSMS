import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Realtime chat transport (Supabase Realtime Broadcast).
 *
 * This replaces the standalone Socket.IO mini-service. Persistence stays in
 * the HTTP API (`/api/messages`, `/api/conversations`); this module only
 * carries the ephemeral *push* layer between two open browsers:
 *
 *   receive_message      — new message delivered to the recipient
 *   messages_read        — recipient opened the thread; sender clears checkmarks
 *   user_typing          — partner is typing (ephemeral, not persisted)
 *   user_stopped_typing  — partner stopped typing
 *
 * Channel naming: one Broadcast channel per user — `user-<userId>`. Anything
 * published to that channel is received by that user's open browser tabs.
 *
 * ⚠️ Security note: channels are identified by name and subscribed with the
 * anon key, so they are NOT cryptographically private — authorization is
 * enforced in the HTTP API (persistence), not the transport. This matches the
 * app's existing posture. Hardening options (Supabase Realtime authorization
 * tokens / RLS-scoped channels) are documented in the README as a follow-up.
 */

// ---------------------------------------------------------------------------
// Event payload shapes — kept identical to the old Socket.IO contract so the
// React UI handlers don't change.
// ---------------------------------------------------------------------------
export interface ReceiveMessagePayload {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  content: string
  projectId: string | null
  createdAt: string // ISO string
  isRead: boolean
}

export interface MessagesReadPayload {
  /** The user who just read the messages (= the partner to notify). */
  userId: string
}

export interface TypingPayload {
  senderId: string
}

export type RealtimeEvent =
  | "receive_message"
  | "messages_read"
  | "user_typing"
  | "user_stopped_typing"

/** Build the per-user Broadcast channel name. */
export function userChannel(userId: string): string {
  return `user-${userId}`
}

// ---------------------------------------------------------------------------
// SERVER side — publishing (runs inside API route handlers).
// Uses the service-role key so it can broadcast regardless of RLS.
// ---------------------------------------------------------------------------
let serverClient: SupabaseClient | null = null
let missingConfigWarned = false
function getServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    // Realtime is optional at the transport level — persistence still works
    // over HTTP. Log once and no-op rather than crashing the request.
    if (!missingConfigWarned) {
      console.warn(
        "[realtime] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — publish calls will be skipped.",
      )
      missingConfigWarned = true
    }
    return null
  }
  if (!serverClient) {
    serverClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serverClient
}

/**
 * Publish an event to a user's channel. Non-throwing: a realtime failure
 * must never break an HTTP request that already persisted the data.
 */
export async function publishToUser<P>(
  userId: string,
  event: RealtimeEvent,
  payload: P,
): Promise<void> {
  const client = getServerClient()
  if (!client) return
  try {
    await client.channel(userChannel(userId)).send({
      type: "broadcast",
      event,
      payload,
    })
  } catch (err) {
    console.error(`[realtime] publishToUser(${event}) failed:`, err)
  }
}

// ---------------------------------------------------------------------------
// CLIENT side — subscribing (runs in the browser via the realtime hook).
// Uses the anon key.
// ---------------------------------------------------------------------------
export function createRealtimeClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      "[realtime] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars are required on the client.",
    )
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type RealtimeHandlers = {
  onReceiveMessage?: (msg: ReceiveMessagePayload) => void
  onMessagesRead?: (payload: MessagesReadPayload) => void
  onUserTyping?: (payload: TypingPayload) => void
  onUserStoppedTyping?: (payload: TypingPayload) => void
}

/**
 * Subscribe to a user's realtime channel. Returns an unsubscribe function.
 * Safe to call multiple times — each call is an independent subscription.
 */
export function subscribeUser(
  client: SupabaseClient,
  userId: string,
  handlers: RealtimeHandlers,
): () => void {
  const channel = client
    .channel(userChannel(userId))
    .on("broadcast", { event: "receive_message" }, (msg) =>
      handlers.onReceiveMessage?.(msg.payload as ReceiveMessagePayload),
    )
    .on("broadcast", { event: "messages_read" }, (msg) =>
      handlers.onMessagesRead?.(msg.payload as MessagesReadPayload),
    )
    .on("broadcast", { event: "user_typing" }, (msg) =>
      handlers.onUserTyping?.(msg.payload as TypingPayload),
    )
    .on("broadcast", { event: "user_stopped_typing" }, (msg) =>
      handlers.onUserStoppedTyping?.(msg.payload as TypingPayload),
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}
