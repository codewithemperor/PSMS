"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Edit3,
  MessageSquare,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuthStore } from "@/stores/auth-store"
import { useSocket } from "@/hooks/use-socket"
import socket from "@/lib/socket"
import { formatNameWithRole } from "@/lib/format"
import { ChatWindow } from "./chat-window"

interface Conversation {
  userId: string
  name: string
  role: string
  lastMessage: { content: string; createdAt: string }
  unreadCount: number
}

interface NewMessageUser {
  id: string
  name: string
  email?: string
  role?: string
  department?: string | null
}

/**
 * Fetches the candidate recipients for the New Message dialog.
 *
 * Uses the unified `/api/contacts` endpoint which returns role-appropriate
 * contacts:
 *   ADMIN      → everyone (except self)
 *   SUPERVISOR → allocated students + all admins
 *   STUDENT    → their supervisor + all admins
 */
async function fetchCandidateRecipients(): Promise<NewMessageUser[]> {
  const res = await fetch("/api/contacts")
  if (!res.ok) return []
  const json = await res.json()
  const list: NewMessageUser[] = (json?.data ?? []).map(
    (u: {
      id: string
      name: string
      email?: string
      role?: string
      department?: string | null
    }) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
    }),
  )
  return list
}

/**
 * Tailwind classes for the small role badge shown next to a candidate in
 * the New Message dialog. Purple is allowed ONLY for the admin badge to
 * match the sidebar admin-badge convention; supervisor uses emerald,
 * student uses slate. No indigo/blue.
 */
function roleBadgeClasses(role?: string): string {
  if (role === "ADMIN") return "bg-purple-100 text-purple-700"
  if (role === "SUPERVISOR") return "bg-emerald-100 text-emerald-700"
  return "bg-slate-100 text-slate-700"
}

/** Short, human-readable label for a role badge. */
function roleBadgeLabel(role?: string): string {
  if (role === "ADMIN") return "Admin"
  if (role === "SUPERVISOR") return "Supervisor"
  if (role === "STUDENT") return "Student"
  return role ?? "User"
}

export function ChatList() {
  const user = useAuthStore((s) => s.user)
  const { isConnected } = useSocket()
  const queryClient = useQueryClient()

  // Currently selected conversation partner. We track both the userId and
  // the partner's role/name so the ChatWindow header can show a role
  // prefix even for partners that don't yet appear in the conversations
  // list (e.g. right after starting a new conversation).
  const [selected, setSelected] = useState<{
    userId: string
    name: string
    role?: string
  } | null>(null)
  const [search, setSearch] = useState("")
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [newMessageSearch, setNewMessageSearch] = useState("")

  // Conversation list (TanStack Query — auto-refetches on invalidation)
  const { data: conversations, isLoading: convLoading } = useQuery<
    Conversation[]
  >({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations")
      const json = await res.json()
      return (json.data ?? []) as Conversation[]
    },
    refetchInterval: 15_000, // light polling as a fallback to socket pushes
  })

  // New Message dialog candidates — sourced from the unified
  // `/api/contacts` endpoint.
  const { data: candidates, isLoading: candidatesLoading } = useQuery<
    NewMessageUser[]
  >({
    queryKey: ["new-message-candidates", user?.role],
    queryFn: () => fetchCandidateRecipients(),
    enabled: !!user && newMessageOpen,
  })

  // When opening a conversation via the New Message dialog we want the
  // conversation list to refresh so the new partner shows up. Invalidate
  // whenever the dialog closes (a message may have been started).
  useEffect(() => {
    if (!newMessageOpen) {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    }
  }, [newMessageOpen, queryClient])

  // ---------- Live-update the conversation list on new messages ----------
  // When a message arrives (incoming or outgoing), invalidate the
  // conversations query so the list refetches: partner moves to the top,
  // preview updates, unread badge increments — all without a manual refresh.
  useEffect(() => {
    function handleReceiveMessage() {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    }
    function handleMessageSent() {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    }
    socket.on("receive_message", handleReceiveMessage)
    socket.on("message_sent", handleMessageSent)
    return () => {
      socket.off("receive_message", handleReceiveMessage)
      socket.off("message_sent", handleMessageSent)
    }
  }, [queryClient])

  const filteredConversations = useMemo(() => {
    const list = conversations ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessage.content.toLowerCase().includes(q),
    )
  }, [conversations, search])

  const filteredCandidates = useMemo(() => {
    const list = candidates ?? []
    if (!newMessageSearch.trim()) return list
    const q = newMessageSearch.toLowerCase()
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    )
  }, [candidates, newMessageSearch])

  // If the selected partner also appears in the conversations list, prefer
  // that record (it always has the freshest name/role).
  const selectedConv = (conversations ?? []).find(
    (c) => c.userId === selected?.userId,
  )
  const selectedName = selectedConv?.name ?? selected?.name ?? "Conversation"
  const selectedRole = selectedConv?.role ?? selected?.role

  const handleSelectConversation = (userId: string) => {
    const conv = (conversations ?? []).find((c) => c.userId === userId)
    setSelected({
      userId,
      name: conv?.name ?? "Conversation",
      role: conv?.role,
    })
  }

  const handleStartNewConversation = (u: NewMessageUser) => {
    setSelected({ userId: u.id, name: u.name, role: u.role })
    setNewMessageOpen(false)
    setNewMessageSearch("")
    // Pre-fetch the conversation list so the new partner shows up immediately
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-4 md:-m-6 overflow-hidden border-y border-slate-200/60 bg-white">
      {/* Left panel: conversation list */}
      <div
        className={cn(
          "w-full flex-col border-r border-slate-200/60 bg-white md:flex md:w-80 lg:w-96",
          selected ? "hidden md:flex" : "flex",
        )}
      >
        <div className="border-b border-slate-200/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Messages</h2>
              <p className="text-[11px] text-slate-400">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Real-time connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-slate-300" />
                    Messaging enabled
                  </span>
                )}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-lg"
              onClick={() => setNewMessageOpen(true)}
              aria-label="Start new conversation"
            >
              <Edit3 className="size-5 text-slate-500" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-slate-300" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={MessageSquare}
                title={search ? "No matches" : "No conversations yet"}
                description={
                  search
                    ? "Try a different search term."
                    : "Tap the pencil icon to start a new conversation."
                }
              />
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = selected?.userId === conv.userId
              return (
                <button
                  key={conv.userId}
                  type="button"
                  onClick={() => handleSelectConversation(conv.userId)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-slate-100/50 p-4 text-left transition hover:bg-slate-50",
                    isActive && "border-l-[3px] border-l-emerald-600 bg-emerald-50/60",
                  )}
                >
                  <div className="relative">
                    <UserAvatar name={conv.name} size="md" />
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white",
                        isConnected ? "bg-emerald-500" : "bg-slate-300",
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          conv.unreadCount > 0
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-700",
                        )}
                      >
                        {formatNameWithRole(conv.name, conv.role)}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatDistanceToNowStrict(
                          new Date(conv.lastMessage.createdAt),
                          { addSuffix: false },
                        )}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate pr-2 text-xs text-slate-400">
                        {conv.lastMessage.content}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel: chat window */}
      <div
        className={cn(
          "flex-1 flex-col bg-white md:flex",
          !selected && "hidden md:flex",
        )}
      >
        {selected ? (
          <ChatWindow
            partnerId={selected.userId}
            partnerName={selectedName}
            partnerRole={selectedRole}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Choose a conversation from the list, or start a new one with the pencil icon."
            />
          </div>
        )}
      </div>

      {/* New Message dialog */}
      <Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100 p-4">
            <DialogTitle className="text-base font-semibold text-slate-800">
              New Message
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {user?.role === "STUDENT"
                ? "Send a message to your supervisor or an administrator."
                : user?.role === "SUPERVISOR"
                  ? "Send a message to one of your allocated students or an administrator."
                  : "Search for anyone in the system to start a conversation."}
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-slate-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or email…"
                value={newMessageSearch}
                onChange={(e) => setNewMessageSearch(e.target.value)}
                className="rounded-lg pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {candidatesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-6 animate-spin text-slate-300" />
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-slate-400">
                  {user?.role === "STUDENT"
                    ? "No contacts available yet."
                    : "No users found."}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredCandidates.map((u) => (
                  <motion.button
                    key={u.id}
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleStartNewConversation(u)}
                    className="flex w-full items-center gap-3 border-b border-slate-50 p-3 text-left transition hover:bg-slate-50"
                  >
                    <UserAvatar name={u.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {formatNameWithRole(u.name, u.role)}
                      </p>
                      {u.email && (
                        <p className="truncate text-xs text-slate-400">
                          {u.email}
                        </p>
                      )}
                    </div>
                    {u.role && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          roleBadgeClasses(u.role),
                        )}
                      >
                        {roleBadgeLabel(u.role)}
                      </span>
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <Button
              variant="ghost"
              className="w-full rounded-lg text-slate-500"
              onClick={() => setNewMessageOpen(false)}
            >
              <X className="mr-1 size-4" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
