"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  MessageCircle,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Search,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FeedbackStatus } from "@/types"

interface FeedbackRow {
  id: string
  content: string
  status: FeedbackStatus
  createdAt: string
  author: { id: string; name: string }
  student: { id: string; name: string }
  project: { id: string; title: string }
  document: { id: string; title: string } | null
}

const statusBadge: Record<FeedbackStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ADDRESSED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-slate-100 text-slate-500",
}

const statusIcon: Record<FeedbackStatus, typeof Clock> = {
  PENDING: Clock,
  ADDRESSED: CheckCircle2,
  DISMISSED: XCircle,
}

const statusLabel: Record<FeedbackStatus, string> = {
  PENDING: "Pending",
  ADDRESSED: "Addressed",
  DISMISSED: "Dismissed",
}

export function ViewFeedback() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const params = new URLSearchParams()
  if (statusFilter !== "all") params.set("status", statusFilter.toUpperCase())

  const { data: feedback, isLoading } = useQuery<FeedbackRow[]>({
    queryKey: ["my-feedback", statusFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/feedback?${params.toString()}`,
      )
      const json = await res.json()
      return json.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      feedbackId,
      status,
    }: {
      feedbackId: string
      status: FeedbackStatus
    }) => {
      const res = await fetch(`/api/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Update failed")
      return json
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] })
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const allFeedback = feedback ?? []
  const filtered = search
    ? allFeedback.filter(
        (f) =>
          f.content.toLowerCase().includes(search.toLowerCase()) ||
          f.author.name.toLowerCase().includes(search.toLowerCase()) ||
          f.project.title.toLowerCase().includes(search.toLowerCase()),
      )
    : allFeedback

  const pendingCount = allFeedback.filter((f) => f.status === "PENDING").length
  const addressedCount = allFeedback.filter(
    (f) => f.status === "ADDRESSED",
  ).length

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Feedback</h1>
          <p className="mt-1 text-sm text-slate-500">
            Feedback from your supervisor on your project and documents
          </p>
        </div>
      </motion.div>

      {/* Stat pills */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200/60 bg-white p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {allFeedback.length}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-slate-500">Pending</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-slate-500">Addressed</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {addressedCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search feedback by content, author, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full rounded-lg sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="addressed">Addressed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No feedback yet"
          description="When your supervisor gives you feedback on your project or documents, it will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((f, idx) => {
            const StatusIcon = statusIcon[f.status]
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card
                  className={`rounded-xl transition-shadow hover:shadow-md ${
                    f.status === "PENDING"
                      ? "border-amber-200/60 bg-amber-50/20"
                      : "border-slate-200/60 bg-white"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <UserAvatar name={f.author.name} size="md" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800">
                              {f.author.name}
                            </p>
                            <Badge
                              className={`text-[10px] ${statusBadge[f.status]}`}
                            >
                              <StatusIcon className="mr-0.5 h-2.5 w-2.5" />
                              {statusLabel[f.status]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">
                            on &ldquo;{f.project.title}&rdquo;
                            {f.document && (
                              <>
                                {" "}
                                ·{" "}
                                <span className="inline-flex items-center gap-0.5">
                                  <FileText className="h-3 w-3" />
                                  {f.document.title}
                                </span>
                              </>
                            )}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {formatDistanceToNow(new Date(f.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>

                      {f.status === "PENDING" && (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              updateMutation.mutate({
                                feedbackId: f.id,
                                status: "ADDRESSED",
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Mark Addressed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMutation.mutate({
                                feedbackId: f.id,
                                status: "DISMISSED",
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50"
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg border-l-[3px] border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm leading-relaxed text-slate-700">
                        {f.content}
                      </p>
                    </div>

                    {f.document && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-lg px-2 text-[11px] text-emerald-600 hover:bg-emerald-50"
                        >
                          <Link
                            href={`/student/document-review/${f.document.id}`}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Open Document Review
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
