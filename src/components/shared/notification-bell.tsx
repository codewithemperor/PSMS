"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  Bell,
  FileCheck,
  Upload,
  MessageCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  Info,
  AlertTriangle,
  XCircle,
  CheckCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotificationStore } from "@/stores/notification-store"
import { useAuthStore } from "@/stores/auth-store"
import type { INotification, NotificationType } from "@/types"
import { toast } from "sonner"

const iconMap: Record<NotificationType, LucideIcon> = {
  INFO: Info,
  SUCCESS: CheckCircle2,
  WARNING: AlertTriangle,
  ERROR: XCircle,
  TOPIC_SUBMITTED: FileCheck,
  TOPIC_APPROVED: FileCheck,
  TOPIC_REJECTED: FileCheck,
  DOCUMENT_UPLOADED: Upload,
  FEEDBACK_GIVEN: MessageCircle,
  MILESTONE_COMPLETED: CheckCircle2,
  MILESTONE_DUE: Clock,
  ALLOCATION_ASSIGNED: UserCheck,
}

const iconColorMap: Record<NotificationType, string> = {
  INFO: "text-slate-500 bg-slate-100",
  SUCCESS: "text-emerald-600 bg-emerald-100",
  WARNING: "text-amber-600 bg-amber-100",
  ERROR: "text-rose-600 bg-rose-100",
  TOPIC_SUBMITTED: "text-teal-600 bg-teal-100",
  TOPIC_APPROVED: "text-emerald-600 bg-emerald-100",
  TOPIC_REJECTED: "text-rose-600 bg-rose-100",
  DOCUMENT_UPLOADED: "text-teal-600 bg-teal-100",
  FEEDBACK_GIVEN: "text-emerald-600 bg-emerald-100",
  MILESTONE_COMPLETED: "text-emerald-600 bg-emerald-100",
  MILESTONE_DUE: "text-amber-600 bg-amber-100",
  ALLOCATION_ASSIGNED: "text-teal-600 bg-teal-100",
}

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { notifications, unreadCount, setNotifications, markAsRead, markAllAsRead } =
    useNotificationStore()

  // Poll notifications every 30s
  const { isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Failed to load notifications")
      const json = await res.json()
      setNotifications(json.data ?? [])
      return json
    },
    refetchInterval: 30_000,
    enabled: !!user,
  })

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Failed to mark as read")
    },
    onSuccess: (_data, id) => {
      markAsRead(id)
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Failed to mark all as read")
    },
    onSuccess: () => {
      markAllAsRead()
      toast.success("All notifications marked as read")
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  const handleClick = (n: INotification) => {
    if (!n.isRead) markOneRead.mutate(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-xl border border-slate-200/60 p-0 shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-80">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-xs text-slate-400">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-slate-200" />
              <p className="mt-3 text-sm text-slate-400">No new notifications</p>
              <p className="text-xs text-slate-300">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((n) => {
                const Icon = iconMap[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                      !n.isRead ? "border-l-[3px] border-emerald-500 bg-emerald-50/30" : "border-l-[3px] border-transparent"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColorMap[n.type] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-snug ${
                          n.isRead
                            ? "font-medium text-slate-600"
                            : "font-semibold text-slate-700"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-300">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
