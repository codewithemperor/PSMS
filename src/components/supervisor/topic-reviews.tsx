"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Check,
  Edit,
  X,
  Loader2,
  FileCheck,
  Search,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import type { TopicStatus } from "@/types"

interface TopicRow {
  id: string
  title: string
  description: string
  studentId: string
  studentName: string
  studentEmail: string
  studentMatricNo: string | null
  studentDepartment: string | null
  supervisorId: string
  supervisorName: string
  projectId: string | null
  status: TopicStatus
  submittedAt: string
  reviewedAt: string | null
  reviewerComment: string | null
}

interface TopicsResponse {
  success: boolean
  data: TopicRow[]
  statusCounts: Record<string, number>
  pagination: { total: number; page: number; totalPages: number }
}

type Action = "approve" | "reject" | "request_revision"

const statusBadgeClass: Record<TopicStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  REVISION_REQUIRED: "bg-orange-100 text-orange-700",
}

const statusLabel: Record<TopicStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUIRED: "Revision Required",
}

const filterPills: { value: "ALL" | TopicStatus; label: string; className: string }[] = [
  { value: "ALL", label: "All", className: "border-slate-300 text-slate-600 hover:bg-slate-50" },
  { value: "PENDING", label: "Pending", className: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { value: "APPROVED", label: "Approved", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  { value: "REVISION_REQUIRED", label: "Revision", className: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { value: "REJECTED", label: "Rejected", className: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
]

export function TopicReviews() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<"ALL" | TopicStatus>("ALL")
  const [search, setSearch] = useState("")
  const [approveTarget, setApproveTarget] = useState<TopicRow | null>(null)
  const [commentTarget, setCommentTarget] = useState<{
    topic: TopicRow
    action: "reject" | "request_revision"
  } | null>(null)
  const [comment, setComment] = useState("")

  // --- Fetch topics (the GET endpoint auto-filters by supervisorId for SUPERVISOR role) ---
  const { data, isLoading } = useQuery<TopicsResponse>({
    queryKey: ["supervisor-topics", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      if (search) params.set("search", search)
      params.set("limit", "50")
      const res = await fetch(
        `/api/topics?${params.toString()}`,
      )
      const json = await res.json()
      return json as TopicsResponse
    },
  })

  const topics = data?.data ?? []
  const statusCounts = data?.statusCounts ?? {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    REVISION_REQUIRED: 0,
  }
  const totalCount =
    statusCounts.PENDING +
    statusCounts.APPROVED +
    statusCounts.REJECTED +
    statusCounts.REVISION_REQUIRED

  // --- Action mutation (approve / reject / request_revision) ---
  const actionMutation = useMutation({
    mutationFn: async ({
      topicId,
      action,
      commentText,
    }: {
      topicId: string
      action: Action
      commentText?: string
    }) => {
      const res = await fetch(
        `/api/topics/${topicId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment: commentText,
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Action failed")
      return json as { message: string }
    },
    onSuccess: (responseData) => {
      toast.success(responseData.message)
      queryClient.invalidateQueries({ queryKey: ["supervisor-topics"] })
      queryClient.invalidateQueries({ queryKey: ["topics"] })
      queryClient.invalidateQueries({ queryKey: ["supervisor-dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["supervisor-students"] })
      setApproveTarget(null)
      setCommentTarget(null)
      setComment("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Topic Reviews</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review topic submissions from your students
          </p>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by topic title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg pl-9"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {filterPills.map((p) => {
          const count =
            p.value === "ALL"
              ? totalCount
              : statusCounts[p.value as TopicStatus] ?? 0
          const isActive = statusFilter === p.value
          return (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "ring-2 ring-emerald-500 ring-offset-1 " + p.className
                  : p.className
              }`}
            >
              {p.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Topic Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No topics found"
          description="When your students submit topics for review, they will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic, idx) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className="flex h-full flex-col rounded-xl border-slate-200/60 transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <UserAvatar name={topic.studentName} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          {topic.title}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {topic.studentName}
                          {topic.studentMatricNo && (
                            <>
                              {" · "}
                              <span className="text-slate-400">
                                {topic.studentMatricNo}
                              </span>
                            </>
                          )}
                          {topic.studentDepartment && (
                            <>
                              {" · "}
                              <span className="text-slate-400">
                                {topic.studentDepartment}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
                          {topic.description}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Submitted{" "}
                          {format(new Date(topic.submittedAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`shrink-0 ${statusBadgeClass[topic.status]}`}
                    >
                      {statusLabel[topic.status]}
                    </Badge>
                  </div>

                  {/* Reviewer comment */}
                  {topic.reviewerComment && (
                    <div className="mt-3 rounded-lg border-l-[3px] border-slate-300 bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">
                        Your Comment:
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {topic.reviewerComment}
                      </p>
                    </div>
                  )}

                  {/* Project link badge if approved */}
                  {topic.status === "APPROVED" && topic.projectId && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                      Project created for this student
                    </div>
                  )}

                  {/* Action buttons for PENDING topics */}
                  {topic.status === "PENDING" && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Button
                        size="sm"
                        onClick={() => setApproveTarget(topic)}
                        disabled={actionMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCommentTarget({
                            topic,
                            action: "request_revision",
                          })
                        }
                        disabled={actionMutation.isPending}
                        className="border-amber-200 text-amber-600 hover:bg-amber-50"
                      >
                        <Edit className="mr-1 h-3.5 w-3.5" />
                        Request Revision
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCommentTarget({ topic, action: "reject" })
                        }
                        disabled={actionMutation.isPending}
                        className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Approve confirmation */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve this topic?"
        description={`"${approveTarget?.title}" will be marked as approved. A project will be created for ${approveTarget?.studentName} with default milestones, and they will be notified.`}
        confirmText="Approve & Create Project"
        variant="default"
        onConfirm={async () => {
          if (approveTarget) {
            await actionMutation.mutateAsync({
              topicId: approveTarget.id,
              action: "approve",
            })
          }
        }}
      />

      {/* Reject / Revision dialog with comment */}
      <Dialog
        open={!!commentTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCommentTarget(null)
            setComment("")
          }
        }}
      >
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              {commentTarget?.action === "reject"
                ? "Reject Topic"
                : "Request Revision"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {commentTarget?.action === "reject"
                ? "Provide a clear reason for rejecting this topic. The student will see your comment."
                : "Describe the revisions the student needs to make. They will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm text-slate-700">
              {commentTarget?.action === "reject"
                ? "Reason for rejection"
                : "Revisions needed"}
              <span className="text-rose-500"> *</span>
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                commentTarget?.action === "reject"
                  ? "e.g. The topic is too broad and overlaps with existing work..."
                  : "e.g. Please narrow the scope to focus on..."
              }
              rows={4}
              className="rounded-lg"
            />
            {comment.trim().length === 0 && (
              <p className="text-xs text-slate-400">
                A comment is required for this action.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommentTarget(null)
                setComment("")
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              disabled={
                comment.trim().length === 0 || actionMutation.isPending
              }
              onClick={() => {
                if (commentTarget) {
                  actionMutation.mutate({
                    topicId: commentTarget.topic.id,
                    action: commentTarget.action,
                    commentText: comment.trim(),
                  })
                }
              }}
              className={`rounded-lg text-white ${
                commentTarget?.action === "reject"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {actionMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {commentTarget?.action === "reject"
                ? "Reject Topic"
                : "Send Revision Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
