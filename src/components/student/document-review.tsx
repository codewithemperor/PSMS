"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Send,
  Loader2,
  FileText,
  Download,
  Clock,
  CheckCircle2,
  MessageCircle,
  GitBranch,
  User as UserIcon,
  Mail,
  Building2,
  Briefcase,
  GraduationCap,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"

interface ReviewAuthor {
  id: string
  name: string
  role: string
  avatar?: string | null
}

interface ReviewMessage {
  id: string
  content: string
  status: string
  createdAt: string
  author: ReviewAuthor
}

interface ReviewVersion {
  id: string
  title: string
  version: number
  isFinal: boolean
  createdAt: string
  fileName: string
  fileSize: number
}

interface ReviewData {
  document: {
    id: string
    title: string
    description: string | null
    fileName: string
    fileSize: number
    fileType: string
    version: number
    documentType: string
    isFinal: boolean
    createdAt: string
    uploadedBy: { id: string; name: string; role: string }
  }
  project: {
    id: string
    title: string
    status: string
    student: {
      id: string
      name: string
      email: string
      department: string | null
      matricNo: string | null
    }
    supervisor: {
      id: string
      name: string
      email: string
      department: string | null
      supervisorProfile: { specialization: string | null } | null
    }
  }
  feedback: ReviewMessage[]
  versions: ReviewVersion[]
  pendingCount: number
}

interface DocumentReviewProps {
  documentId: string
  /** "student" | "supervisor" — drives back-link + role label */
  viewer: "student" | "supervisor"
}

const docTypeBadge: Record<string, string> = {
  PROPOSAL: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-slate-100 text-slate-600",
  LITERATURE_REVIEW: "bg-teal-50 text-teal-700",
  METHODOLOGY: "bg-amber-50 text-amber-700",
  DATA_ANALYSIS: "bg-orange-50 text-orange-700",
  FINAL_REPORT: "bg-rose-50 text-rose-700",
  OTHER: "bg-slate-50 text-slate-500",
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentReview({ documentId, viewer }: DocumentReviewProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery<ReviewData>({
    queryKey: ["document-review", documentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/document-review/${documentId}`,
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load review")
      return json.data
    },
    refetchInterval: 15000, // light polling so new replies appear
  })

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(
        `/api/document-review/${documentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Reply failed")
      return json
    },
    onSuccess: () => {
      setDraft("")
      queryClient.invalidateQueries({
        queryKey: ["document-review", documentId],
      })
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] })
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] })
    },
  })

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data?.feedback.length])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-lg"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <Card className="rounded-xl border-rose-200">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <AlertCircle className="h-10 w-10 text-rose-400" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Couldn&apos;t load this review
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {error?.message ??
                "This document may have been removed or you don't have access."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const d = data
  const doc = d.document
  const messages = d.feedback
  const backHref = viewer === "student" ? "/student/upload" : "/supervisor/documents"
  const messagesHref = viewer === "student" ? "/student/messages" : "/supervisor/messages"

  const handleSend = () => {
    const c = draft.trim()
    if (c.length < 5) return
    replyMutation.mutate(c)
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-fit rounded-lg text-slate-500 hover:text-slate-700"
        >
          <Link href={backHref}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to {viewer === "student" ? "documents" : "student documents"}
          </Link>
        </Button>
        <Badge className="bg-emerald-50 text-emerald-700">
          <MessageCircle className="mr-1 h-3 w-3" />
          Review Thread
        </Badge>
      </div>

      {/* Document header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden rounded-xl border-slate-200/60">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-800">
                      {doc.title}
                    </h1>
                    {doc.isFinal && (
                      <Badge className="bg-emerald-100 text-[10px] text-emerald-700">
                        Final
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {doc.fileName} · {formatFileSize(doc.fileSize)} ·{" "}
                    {format(new Date(doc.createdAt), "MMM d, yyyy")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge
                      className={`text-[10px] ${
                        docTypeBadge[doc.documentType] ??
                        "bg-slate-50 text-slate-500"
                      }`}
                    >
                      {doc.documentType.replace(/_/g, " ")}
                    </Badge>
                    <Badge className="bg-slate-50 text-[10px] text-slate-500">
                      <GitBranch className="mr-0.5 h-2.5 w-2.5" />v{doc.version}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <UserIcon className="h-2.5 w-2.5" />
                      Uploaded by {doc.uploadedBy.name}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() =>
                  window.open(
                    `/api/documents/${doc.id}/download`,
                    "_blank",
                  )
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </Button>
            </div>

            {doc.description && (
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {doc.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main: chat timeline */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2"
        >
          <Card className="flex h-[34rem] flex-col rounded-xl border-slate-200/60">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                Review Conversation
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {messages.length} message{messages.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
              {d.pendingCount > 0 && (
                <Badge className="bg-amber-100 text-[10px] text-amber-700">
                  <Clock className="mr-0.5 h-2.5 w-2.5" />
                  {d.pendingCount} pending
                </Badge>
              )}
            </CardHeader>

            {/* Messages scroll area */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageCircle className="h-10 w-10 text-slate-200" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    No messages yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    Start the conversation.{" "}
                    {viewer === "student"
                      ? "Ask a question or share a note about this document — your supervisor will see it here."
                      : "Give your first round of feedback on this document."}
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMine = m.author.id === user?.id
                  const showAuthor =
                    idx === 0 || messages[idx - 1].author.id !== m.author.id
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex gap-2.5",
                        isMine && "flex-row-reverse",
                      )}
                    >
                      <div className="w-8 shrink-0">
                        {showAuthor && (
                          <UserAvatar name={m.author.name} size="sm" />
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex max-w-[78%] flex-col",
                          isMine ? "items-end" : "items-start",
                        )}
                      >
                        {showAuthor && (
                          <div
                            className={cn(
                              "mb-1 flex items-center gap-1.5 text-[10px] text-slate-400",
                              isMine && "flex-row-reverse",
                            )}
                          >
                            <span className="font-semibold text-slate-600">
                              {m.author.name}
                            </span>
                            <Badge
                              className={cn(
                                "text-[9px]",
                                m.author.role === "SUPERVISOR"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
                              {m.author.role === "SUPERVISOR"
                                ? "Supervisor"
                                : "Student"}
                            </Badge>
                            <span>
                              {format(new Date(m.createdAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                            isMine
                              ? "rounded-tr-sm bg-emerald-600 text-white"
                              : "rounded-tl-sm border border-slate-200 bg-white text-slate-700",
                          )}
                        >
                          {m.content}
                        </div>
                        <span
                          className={cn(
                            "mt-1 text-[10px] text-slate-400",
                            isMine && "text-right",
                          )}
                        >
                          {formatDistanceToNow(new Date(m.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div className="border-t border-slate-100 p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    viewer === "student"
                      ? "Write a reply or question about this document..."
                      : "Write feedback for the student on this document..."
                  }
                  rows={2}
                  className="min-h-[44px] resize-none rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={
                    replyMutation.isPending || draft.trim().length < 5
                  }
                  className="h-11 shrink-0 rounded-lg bg-emerald-600 px-4 hover:bg-emerald-700"
                >
                  {replyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-slate-400">
                Press ⌘/Ctrl + Enter to send · Min 5 characters
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Sidebar: versions + participants */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Versions */}
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <GitBranch className="h-4 w-4 text-emerald-500" />
                Versions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {d.versions.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-400">
                  No versions recorded
                </p>
              ) : (
                d.versions.map((v) => {
                  const isCurrent = v.id === doc.id
                  return (
                    <Link
                      key={v.id}
                      href={
                        viewer === "student"
                          ? `/student/document-review/${v.id}`
                          : `/supervisor/document-review/${v.id}`
                      }
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors",
                        isCurrent
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-slate-100 hover:border-emerald-200 hover:bg-slate-50",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            v{v.version}
                          </span>
                          {v.isFinal && (
                            <Badge className="bg-emerald-100 text-[9px] text-emerald-700">
                              Final
                            </Badge>
                          )}
                          {isCurrent && (
                            <Badge className="bg-emerald-600 text-[9px] text-white">
                              Current
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          {format(new Date(v.createdAt), "MMM d, yyyy")} ·{" "}
                          {formatFileSize(v.fileSize)}
                        </p>
                      </div>
                      {isCurrent ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <ArrowLeft className="h-3.5 w-3.5 shrink-0 rotate-180 text-slate-300" />
                      )}
                    </Link>
                  )
                })
              )}
              {viewer === "student" && (
                <Link
                  href="/student/upload"
                  className="mt-2 block rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-2.5 text-center text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  + Upload new version
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Project + participants */}
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Briefcase className="h-4 w-4 text-emerald-500" />
                Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {d.project.title}
                </p>
                <Badge className="mt-1.5 bg-slate-100 text-[10px] text-slate-600">
                  {d.project.status.replace(/_/g, " ")}
                </Badge>
              </div>

              {/* Student */}
              <ParticipantRow
                role="Student"
                name={d.project.student.name}
                email={d.project.student.email}
                department={d.project.student.department}
                matricNo={d.project.student.matricNo}
                icon={UserIcon}
                accent={viewer === "student" ? "emerald" : "slate"}
              />

              {/* Supervisor */}
              <ParticipantRow
                role="Supervisor"
                name={d.project.supervisor.name}
                email={d.project.supervisor.email}
                department={d.project.supervisor.department}
                specialization={
                  d.project.supervisor.supervisorProfile?.specialization ?? null
                }
                icon={GraduationCap}
                accent={viewer === "supervisor" ? "emerald" : "slate"}
              />

              <Button
                asChild
                variant="outline"
                className="w-full rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Link href={messagesHref}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Open full chat
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function ParticipantRow({
  role,
  name,
  email,
  department,
  matricNo,
  specialization,
  icon: Icon,
  accent,
}: {
  role: string
  name: string
  email: string
  department?: string | null
  matricNo?: string | null
  specialization?: string | null
  icon: typeof UserIcon
  accent: "emerald" | "slate"
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 p-2.5">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
          accent === "emerald"
            ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
            : "bg-slate-50 text-slate-500 ring-slate-100",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {role}
        </p>
        <p className="truncate text-xs font-bold text-slate-800">{name}</p>
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{email}</p>
        {(department || specialization || matricNo) && (
          <p className="mt-0.5 text-[10px] text-slate-400">
            {department && (
              <span className="inline-flex items-center gap-0.5">
                <Building2 className="h-2.5 w-2.5" />
                {department}
              </span>
            )}
            {specialization && (
              <span className="inline-flex items-center gap-0.5">
                <Briefcase className="ml-1 h-2.5 w-2.5" />
                {specialization}
              </span>
            )}
            {matricNo && <span> · {matricNo}</span>}
          </p>
        )}
      </div>
    </div>
  )
}
