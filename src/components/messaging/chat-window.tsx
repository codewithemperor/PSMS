"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { format, isSameDay } from "date-fns"
import { ArrowLeft, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { MessageSquare, MessageCircle } from "lucide-react"
import { MessageBubble } from "./message-bubble"
import { useAuthStore } from "@/stores/auth-store"
import socket from "@/lib/socket"
import { formatNameWithRole } from "@/lib/format"

interface ChatMessage {
  id: string
  content: string
  senderId: string
  receiverId: string
  isRead: boolean
  createdAt: string
  // Optional — only set on optimistic messages pending server confirmation
  pending?: boolean
  // Optional — set when the HTTP POST failed (network error / server error)
  failed?: boolean
}

interface ChatWindowProps {
  partnerId: string
  partnerName: string
  partnerRole?: string
  onBack: () => void
}

interface ReceivePayload {
  id: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
  isRead: boolean
}

interface MessageSentPayload {
  id: string
  content: string
  receiverId: string
  createdAt: string
  isRead: boolean
}

const TYPING_DEBOUNCE_MS = 2000

function DateSeparator({ iso }: { iso: string }) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  let label: string
  if (isSameDay(d, today)) label = "Today"
  else if (isSameDay(d, yesterday)) label = "Yesterday"
  else label = format(d, "MMM d, yyyy")
  return (
    <div className="my-3 flex items-center justify-center">
      <div className="rounded-full bg-slate-100 px-3 py-1">
        <span className="text-[10px] font-medium text-slate-500">{label}</span>
      </div>
    </div>
  )
}

export function ChatWindow({ partnerId, partnerName, partnerRole, onBack }: ChatWindowProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Typing debounce state
  const lastTypingEmitRef = useRef<number>(0)
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------- Load message history (HTTP fallback) ----------
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setIsPartnerTyping(false)

    async function load() {
      try {
        const res = await fetch(
          `/api/messages?userId=${encodeURIComponent(partnerId)}`,
          { credentials: "include" },
        )
        if (!res.ok) throw new Error("Failed to load messages")
        const json = await res.json()
        if (cancelled) return
        const list: ChatMessage[] = (json.data ?? []).map(
          (m: ChatMessage) => ({
            id: m.id,
            content: m.content,
            senderId: m.senderId,
            receiverId: m.receiverId,
            isRead: m.isRead,
            createdAt: m.createdAt,
          }),
        )
        setMessages(list)
        // The HTTP route already marks received messages as read in the DB.
        // Notify the partner's other tabs (if any) via socket so their bubbles
        // update to "read" in real time.
        if (userId && socket.connected) {
          socket.emit("mark_messages_read", { senderId: partnerId })
        }
      } catch (err) {
        console.error("[chat] load error:", err)
        toast.error("Could not load messages")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [partnerId, userId])

  // ---------- Auto-scroll on new messages ----------
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ---------- Socket event listeners ----------
  useEffect(() => {
    if (!userId) return

    function handleReceive(payload: ReceivePayload) {
      if (payload.senderId !== partnerId) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev
        return [
          ...prev,
          {
            id: payload.id,
            content: payload.content,
            senderId: payload.senderId,
            receiverId: userId!,
            isRead: false,
            createdAt: payload.createdAt,
          },
        ]
      })
      // Immediately mark as read since this conversation is open
      socket.emit("mark_messages_read", { senderId: partnerId })
    }

    function handleTyping(payload: { senderId: string }) {
      if (payload.senderId === partnerId) setIsPartnerTyping(true)
    }

    function handleStopTyping(payload: { senderId: string }) {
      if (payload.senderId === partnerId) setIsPartnerTyping(false)
    }

    function handleMessagesRead(payload: { userId: string }) {
      // The partner just read MY messages — flip them to "read".
      if (payload.userId === partnerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === userId && !m.isRead ? { ...m, isRead: true } : m,
          ),
        )
      }
    }

    function handleMessageSent(payload: MessageSentPayload) {
      // Server confirmed a sent message — replace the optimistic temp entry
      // (matched by content+createdAt) with the real row.
      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) => m.id.startsWith("temp-") && m.content === payload.content,
        )
        if (idx === -1) return prev
        const copy = [...prev]
        copy[idx] = {
          id: payload.id,
          content: payload.content,
          senderId: userId!,
          receiverId: payload.receiverId,
          isRead: false,
          createdAt: payload.createdAt,
        }
        return copy
      })
    }

    socket.on("receive_message", handleReceive)
    socket.on("user_typing", handleTyping)
    socket.on("user_stopped_typing", handleStopTyping)
    socket.on("messages_read", handleMessagesRead)
    socket.on("message_sent", handleMessageSent)

    return () => {
      socket.off("receive_message", handleReceive)
      socket.off("user_typing", handleTyping)
      socket.off("user_stopped_typing", handleStopTyping)
      socket.off("messages_read", handleMessagesRead)
      socket.off("message_sent", handleMessageSent)
      // Tell the partner we stopped typing when leaving the chat
      socket.emit("stop_typing", { receiverId: partnerId })
    }
  }, [partnerId, userId])

  // ---------- Send message ----------
  const sendMessage = useCallback(async () => {
    const content = draft.trim()
    if (!content || !userId) return

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const optimistic: ChatMessage = {
      id: tempId,
      content,
      senderId: userId,
      receiverId: partnerId,
      isRead: false,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")

    socket.emit("stop_typing", { receiverId: partnerId })

    // --- Socket-primary path ---
    // When the socket is connected, send via socket ONLY. The chat-service's
    // `send_message` handler persists the message to the DB AND emits
    // `message_sent` back to us (so we can replace the optimistic temp id)
    // AND emits `receive_message` to the recipient. Doing BOTH a POST and a
    // socket emit would create duplicate DB rows (one from each path).
    if (socket.connected) {
      // The `message_sent` listener registered in the effect above will
      // replace the temp id with the real DB id once the server confirms.
      // If the socket emit silently fails (rare), the temp bubble stays
      // marked as `pending` and the user can retry.
      socket.emit("send_message", { receiverId: partnerId, content })
      return
    }

    // --- HTTP fallback (socket not connected) ---
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: partnerId, content }),
      })
      if (res.ok) {
        const json = await res.json()
        const saved = json.data
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: saved.id,
                  createdAt: saved.createdAt,
                  pending: false,
                }
              : m,
          ),
        )
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
      )
    }
  }, [draft, partnerId, userId])

  // ---------- Typing indicator ----------
  const handleTyping = useCallback(() => {
    if (!userId) return
    const now = Date.now()
    if (now - lastTypingEmitRef.current > TYPING_DEBOUNCE_MS) {
      socket.emit("typing", { receiverId: partnerId })
      lastTypingEmitRef.current = now
    }
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current)
    stopTypingTimerRef.current = setTimeout(() => {
      socket.emit("stop_typing", { receiverId: partnerId })
      lastTypingEmitRef.current = 0
    }, TYPING_DEBOUNCE_MS)
  }, [partnerId, userId])

  // ---------- Derived render data ----------
  const renderItems: Array<
    | { kind: "date"; key: string; iso: string }
    | { kind: "msg"; key: string; msg: ChatMessage; isConsecutive: boolean }
  > = []
  let lastDateKey = ""
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const dateKey = format(new Date(m.createdAt), "yyyy-MM-dd")
    if (dateKey !== lastDateKey) {
      renderItems.push({ kind: "date", key: `d-${dateKey}`, iso: m.createdAt })
      lastDateKey = dateKey
    }
    const prev = messages[i - 1]
    const isConsecutive =
      !!prev &&
      prev.senderId === m.senderId &&
      isSameDay(new Date(prev.createdAt), new Date(m.createdAt))
    renderItems.push({
      kind: "msg",
      key: m.id,
      msg: m,
      isConsecutive,
    })
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg md:hidden"
            onClick={onBack}
            aria-label="Back to conversation list"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="relative">
            <UserAvatar name={partnerName} size="md" />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {formatNameWithRole(partnerName, partnerRole)}
            </p>
            {isPartnerTyping ? (
              <p className="text-xs text-emerald-600">typing…</p>
            ) : (
              <p className="text-xs text-emerald-600">Online</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg md:hidden"
          onClick={onBack}
          aria-label="Close conversation"
        >
          {/* Reuse ArrowLeft icon-set; the X button on mobile duplicates the back affordance */}
          <MessageCircle className="size-5" />
        </Button>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-slate-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Send the first message to start the conversation."
            />
          </div>
        ) : (
          <>
            {renderItems.map((item) =>
              item.kind === "date" ? (
                <DateSeparator key={item.key} iso={item.iso} />
              ) : (
                <MessageBubble
                  key={item.key}
                  content={item.msg.content}
                  createdAt={item.msg.createdAt}
                  isOwn={item.msg.senderId === userId}
                  isRead={item.msg.isRead}
                  senderName={formatNameWithRole(partnerName, partnerRole)}
                  isConsecutive={item.isConsecutive}
                />
              ),
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {isPartnerTyping && !loading && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex gap-1">
              <span
                className="size-1.5 animate-bounce rounded-full bg-slate-400"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-slate-400"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-slate-400"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span>{partnerName} is typing…</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-200/60 p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              handleTyping()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Type a message…"
            className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border-slate-200"
            rows={1}
          />
          <Button
            className="h-11 w-11 shrink-0 rounded-xl bg-emerald-600 p-0 hover:bg-emerald-700"
            disabled={!draft.trim()}
            onClick={sendMessage}
            aria-label="Send message"
          >
            <Send className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
