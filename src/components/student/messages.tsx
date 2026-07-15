"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { formatDistanceToNow, format } from "date-fns"
import { toast } from "sonner"
import {
  MessageSquare,
  Send,
  Loader2,
  ArrowLeft,
  Search,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuthStore } from "@/stores/auth-store"

interface Conversation {
  partnerId: string
  partnerName: string
  partnerEmail: string
  partnerRole: string
  partnerDepartment: string | null
  lastMessage: string
  lastAt: string
  unreadCount: number
}

interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  isRead: boolean
  createdAt: string
}

interface MessagesProps {
  /** Who the current user can message (label for the empty state) */
  emptyDescription?: string
}

export function Messages({ emptyDescription }: MessagesProps = {}) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Conversation list
  const { data: conversations, isLoading: convLoading } = useQuery<
    Conversation[]
  >({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/messages")
      const json = await res.json()
      return json.data
    },
  })

  // Messages for selected conversation
  const { data: messages, isLoading: msgLoading } = useQuery<Message[]>({
    queryKey: ["messages", selectedPartner],
    queryFn: async () => {
      if (!selectedPartner) return []
      const res = await fetch(
        `/api/messages?conversationWith=${selectedPartner}`,
      )
      const json = await res.json()
      return json.data
    },
    enabled: !!selectedPartner,
    refetchInterval: selectedPartner ? 5000 : false,
  })

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedPartner,
          content,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Send failed")
      return json
    },
    onSuccess: () => {
      setDraft("")
      queryClient.invalidateQueries({
        queryKey: ["messages", selectedPartner],
      })
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || !selectedPartner) return
    sendMutation.mutate(draft.trim())
  }

  const allConversations = conversations ?? []
  const filteredConversations = search
    ? allConversations.filter(
        (c) =>
          c.partnerName.toLowerCase().includes(search.toLowerCase()) ||
          c.partnerEmail.toLowerCase().includes(search.toLowerCase()),
      )
    : allConversations

  const currentMessages = messages ?? []
  const selectedConv = allConversations.find(
    (c) => c.partnerId === selectedPartner,
  )

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chat with your {user?.role === "STUDENT" ? "supervisor" : "students"}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Conversation list */}
        <Card
          className={`rounded-xl border-slate-200/60 lg:col-span-1 ${
            selectedPartner ? "hidden lg:block" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg pl-9"
              />
            </div>
            {convLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">
                  No conversations yet
                </p>
              </div>
            ) : (
              <div className="max-h-[32rem] space-y-1 overflow-y-auto">
                {filteredConversations.map((c) => (
                  <button
                    key={c.partnerId}
                    onClick={() => setSelectedPartner(c.partnerId)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${
                      selectedPartner === c.partnerId
                        ? "bg-emerald-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <UserAvatar name={c.partnerName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {c.partnerName}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(c.lastAt), {
                            addSuffix: false,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-400">
                          {c.lastMessage}
                        </p>
                        {c.unreadCount > 0 && (
                          <Badge className="shrink-0 bg-emerald-500 text-[10px] text-white">
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat panel */}
        <Card
          className={`rounded-xl border-slate-200/60 lg:col-span-2 ${
            !selectedPartner ? "hidden lg:block" : ""
          }`}
        >
          <CardContent className="flex h-[36rem] flex-col p-0">
            {!selectedPartner ? (
              <EmptyState
                icon={MessageSquare}
                title="Select a conversation"
                description={
                  emptyDescription ??
                  "Choose a conversation from the list to start chatting."
                }
              />
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {selectedConv && (
                    <>
                      <UserAvatar
                        name={selectedConv.partnerName}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {selectedConv.partnerName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {selectedConv.partnerEmail}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {msgLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    </div>
                  ) : currentMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageSquare className="h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-sm text-slate-400">
                        No messages yet. Start the conversation!
                      </p>
                    </div>
                  ) : (
                    currentMessages.map((m) => {
                      const isMe = m.senderId === user?.id
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                              isMe
                                ? "rounded-br-sm bg-emerald-600 text-white"
                                : "rounded-bl-sm bg-slate-100 text-slate-700"
                            }`}
                          >
                            <p className="text-sm leading-relaxed">
                              {m.content}
                            </p>
                            <p
                              className={`mt-1 text-[10px] ${
                                isMe ? "text-emerald-100" : "text-slate-400"
                              }`}
                            >
                              {format(new Date(m.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <form
                  onSubmit={handleSend}
                  className="flex items-end gap-2 border-t border-slate-100 p-3"
                >
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    rows={1}
                    className="min-h-[40px] max-h-32 flex-1 resize-none rounded-lg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSend(e)
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      !draft.trim() || sendMutation.isPending
                    }
                    className="h-10 w-10 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
