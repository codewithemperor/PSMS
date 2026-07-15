"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import {
  Loader2,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  FileText,
  Download,
  MessageCircle,
  Mail,
  Building2,
  Briefcase,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronRight,
  Info,
  GraduationCap,
  Hash,
  Flag,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProgressRing } from "@/components/shared/progress-ring"
import { UserAvatar } from "@/components/shared/user-avatar"
import {
  TopicStatePanel,
  type LatestTopicInfo,
} from "@/components/student/topic-state-panel"
import { cn } from "@/lib/utils"
import type { MilestoneStatus, ProjectStatus } from "@/types"

interface StudentData {
  project: {
    id: string
    title: string
    description: string | null
    status: ProjectStatus
    progress: number
    startDate: string | null
    expectedEndDate: string | null
    submittedAt: string | null
    supervisor: {
      id: string
      name: string
      email: string
      department: string | null
      supervisorProfile: { specialization: string | null } | null
    }
    milestones: {
      id: string
      name: string
      status: MilestoneStatus
      order: number
      weight: number
      dueDate: string | null
      completedDate: string | null
      description: string | null
    }[]
    topics: {
      id: string
      title: string
      status: string
      submittedAt: string
      reviewerComment: string | null
      description?: string | null
    }[]
    documents: {
      id: string
      title: string
      fileName: string
      documentType: string
      version?: number
      isFinal?: boolean
      fileSize: number
      createdAt: string
    }[]
    feedback: {
      id: string
      content: string
      status: string
      createdAt: string
      author: { id: string; name: string }
      document: { id: string; title: string } | null
    }[]
  } | null
  latestTopic: LatestTopicInfo | null
  hasProject: boolean
}

const milestoneIcon: Record<MilestoneStatus, typeof Circle> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertCircle,
}

const milestoneIconColor: Record<MilestoneStatus, string> = {
  NOT_STARTED: "text-slate-300",
  IN_PROGRESS: "text-amber-500",
  COMPLETED: "text-emerald-500",
  OVERDUE: "text-rose-500",
}

const projectStatusBadge: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
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

const feedbackStatusBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ADDRESSED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-slate-100 text-slate-500",
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function StudentProject() {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
  const { data, isLoading } = useQuery<StudentData>({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/student")
      const json = await res.json()
      return json.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  if (!data?.hasProject || !data.project) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-slate-800">My Project</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data?.latestTopic
              ? "Your project workspace will appear here once your topic is approved."
              : "Submit a topic to begin your project journey."}
          </p>
        </motion.div>
        <TopicStatePanel topic={data?.latestTopic ?? null} context="project" />
      </div>
    )
  }

  const p = data.project
  const completedMilestones = p.milestones.filter(
    (m) => m.status === "COMPLETED",
  ).length
  const approvedTopic = p.topics.find((t) => t.status === "APPROVED")

  const toggleDoc = (id: string) =>
    setExpandedDocId((cur) => (cur === id ? null : id))

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">My Project</h1>
        <p className="mt-1 text-sm text-slate-500">
          Full overview of your project, milestones, documents, and feedback
        </p>
      </motion.div>

      {/* Project header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="overflow-hidden rounded-xl border-slate-200/60">
          <div className="h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500" />
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">
                    {p.title}
                  </h2>
                  <Badge className={projectStatusBadge[p.status]}>
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                  {p.status === "SUBMITTED" && p.submittedAt && (
                    <Badge className="bg-amber-50 text-amber-700">
                      <Flag className="mr-0.5 h-2.5 w-2.5" />
                      Submitted{" "}
                      {format(new Date(p.submittedAt), "MMM d, yyyy")}
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {p.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  {p.startDate && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Started{" "}
                      {format(new Date(p.startDate), "MMM d, yyyy")}
                    </span>
                  )}
                  {p.expectedEndDate && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expected end{" "}
                      {format(new Date(p.expectedEndDate), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <ProgressRing
                  percentage={p.progress}
                  size={96}
                  strokeWidth={9}
                  label="Done"
                />
                <p className="mt-2 text-xs text-slate-400">
                  {completedMilestones}/{p.milestones.length} milestones
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
            <TabsTrigger
              value="details"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Documents ({p.documents.length})
            </TabsTrigger>
            <TabsTrigger
              value="milestones"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Milestones ({p.milestones.length})
            </TabsTrigger>
            <TabsTrigger
              value="supervisor"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Supervisor
            </TabsTrigger>
          </TabsList>

          {/* TAB: Details */}
          <TabsContent value="details" className="space-y-4">
            <Card className="rounded-xl border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Info className="h-4 w-4 text-slate-400" />
                  Project Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailRow
                    icon={Hash}
                    label="Status"
                    value={p.status.replace(/_/g, " ")}
                  />
                  <DetailRow
                    icon={TrendingUp}
                    label="Progress"
                    value={`${p.progress}%`}
                  />
                  <DetailRow
                    icon={CheckCircle2}
                    label="Milestones done"
                    value={`${completedMilestones} / ${p.milestones.length}`}
                  />
                  <DetailRow
                    icon={FileText}
                    label="Documents uploaded"
                    value={String(p.documents.length)}
                  />
                  {p.startDate && (
                    <DetailRow
                      icon={Calendar}
                      label="Started"
                      value={format(new Date(p.startDate), "MMM d, yyyy")}
                    />
                  )}
                  {p.expectedEndDate && (
                    <DetailRow
                      icon={Clock}
                      label="Expected end"
                      value={format(new Date(p.expectedEndDate), "MMM d, yyyy")}
                    />
                  )}
                </div>

                {p.description && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Project description
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {p.description}
                    </p>
                  </div>
                )}

                {/* Approved topic info */}
                {approvedTopic && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      Approved topic
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {approvedTopic.title}
                    </p>
                    {approvedTopic.description && (
                      <p className="mt-1 text-xs text-slate-500">
                        {approvedTopic.description}
                      </p>
                    )}
                    {approvedTopic.reviewerComment && (
                      <p className="mt-2 text-xs italic text-slate-500">
                        &ldquo;{approvedTopic.reviewerComment}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Documents with inline feedback expansion */}
          <TabsContent value="documents" className="space-y-3">
            <Card className="rounded-xl border-slate-200/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <FileText className="h-4 w-4 text-slate-400" />
                    Documents ({p.documents.length})
                  </CardTitle>
                  <Link
                    href="/student/upload"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Upload new
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {p.documents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No documents uploaded yet. Use the upload page to share your
                    work with your supervisor.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {p.documents.map((d) => {
                      const docFeedback = p.feedback.filter(
                        (f) => f.document?.id === d.id,
                      )
                      const isOpen = expandedDocId === d.id
                      return (
                        <div
                          key={d.id}
                          className={cn(
                            "overflow-hidden rounded-lg border transition-colors",
                            isOpen
                              ? "border-emerald-200"
                              : "border-slate-100 hover:border-slate-200",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleDoc(d.id)}
                            className="flex w-full items-center gap-3 p-3 text-left"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                              <FileText className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-sm font-medium text-slate-700">
                                  {d.title}
                                </p>
                                {"isFinal" in d && d.isFinal && (
                                  <Badge className="bg-emerald-100 text-[10px] text-emerald-700">
                                    Final
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                <Badge
                                  className={`text-[10px] ${docTypeBadge[d.documentType] ?? "bg-slate-50 text-slate-500"}`}
                                >
                                  {d.documentType.replace(/_/g, " ")}
                                </Badge>
                                {"version" in d && d.version && (
                                  <Badge className="bg-slate-50 text-[10px] text-slate-500">
                                    v{d.version}
                                  </Badge>
                                )}
                                <span>
                                  {formatFileSize(d.fileSize)} ·{" "}
                                  {format(new Date(d.createdAt), "MMM d, yyyy")}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {docFeedback.length > 0 ? (
                                <Badge className="bg-amber-50 text-[10px] text-amber-700">
                                  <MessageCircle className="mr-0.5 h-2.5 w-2.5" />
                                  {docFeedback.length} feedback
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  No feedback
                                </span>
                              )}
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* Expanded panel */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-slate-100"
                              >
                                <div className="space-y-3 bg-slate-50/50 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      Feedback on this document
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        asChild
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 rounded px-2 text-[11px] text-emerald-600 hover:bg-emerald-50"
                                      >
                                        <Link
                                          href={`/student/document-review/${d.id}`}
                                        >
                                          <MessageCircle className="mr-1 h-3 w-3" />
                                          Open Review
                                        </Link>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 rounded px-2 text-[11px] text-slate-500 hover:bg-slate-50"
                                        onClick={() =>
                                          window.open(
                                            `/api/documents/${d.id}/download`,
                                            "_blank",
                                          )
                                        }
                                      >
                                        <Download className="mr-1 h-3 w-3" />
                                        Download
                                      </Button>
                                    </div>
                                  </div>

                                  {docFeedback.length === 0 ? (
                                    <p className="rounded border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-400">
                                      No feedback has been given on this
                                      document yet.
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {docFeedback.map((f) => (
                                        <div
                                          key={f.id}
                                          className="rounded-lg border border-slate-100 bg-white p-3"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <UserAvatar
                                                name={f.author.name}
                                                size="sm"
                                              />
                                              <div>
                                                <p className="text-xs font-medium text-slate-700">
                                                  {f.author.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                  {formatDistanceToNow(
                                                    new Date(f.createdAt),
                                                    { addSuffix: true },
                                                  )}
                                                </p>
                                              </div>
                                            </div>
                                            <Badge
                                              className={`text-[10px] ${
                                                feedbackStatusBadge[f.status] ??
                                                "bg-slate-100 text-slate-500"
                                              }`}
                                            >
                                              {f.status.toLowerCase()}
                                            </Badge>
                                          </div>
                                          <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                            {f.content}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Milestones — READ-ONLY */}
          <TabsContent value="milestones" className="space-y-3">
            <Card className="rounded-xl border-slate-200/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                    Milestones ({completedMilestones}/{p.milestones.length}{" "}
                    completed)
                  </CardTitle>
                  <span className="text-xs text-slate-400">
                    Weighted progress: {p.progress}%
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-3">
                  {p.milestones.map((m, idx) => {
                    const Icon = milestoneIcon[m.status]
                    const isLast = idx === p.milestones.length - 1
                    return (
                      <div key={m.id} className="relative flex gap-3">
                        {!isLast && (
                          <div className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-slate-200" />
                        )}
                        <Icon
                          className={`mt-0.5 h-5 w-5 shrink-0 ${milestoneIconColor[m.status]}`}
                        />
                        <div className="min-w-0 flex-1 rounded-lg border border-slate-100 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  m.status === "COMPLETED"
                                    ? "text-slate-500 line-through"
                                    : "text-slate-700",
                                )}
                              >
                                {m.name}
                                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  weight {m.weight}
                                </span>
                              </p>
                              {m.description && (
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {m.description}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                                {m.dueDate && (
                                  <span>
                                    Due{" "}
                                    {format(new Date(m.dueDate), "MMM d, yyyy")}
                                  </span>
                                )}
                                {m.completedDate && (
                                  <span className="text-emerald-600">
                                    Completed{" "}
                                    {format(
                                      new Date(m.completedDate),
                                      "MMM d, yyyy",
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge
                              className={`shrink-0 text-[10px] ${
                                m.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : m.status === "IN_PROGRESS"
                                    ? "bg-amber-100 text-amber-700"
                                    : m.status === "OVERDUE"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {m.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-[11px] text-slate-400">
                  <Info className="mr-1 inline h-3 w-3" />
                  Milestones are managed by your supervisor. Reach out via
                  messages if you have questions.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Supervisor profile */}
          <TabsContent value="supervisor" className="space-y-3">
            <Card className="rounded-xl border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Supervisor Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <UserAvatar name={p.supervisor.name} size="xl" />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-800">
                      {p.supervisor.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Project Supervisor
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <GraduationCap className="mr-0.5 h-2.5 w-2.5" />
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DetailRow
                    icon={Mail}
                    label="Email"
                    value={p.supervisor.email}
                  />
                  {p.supervisor.department && (
                    <DetailRow
                      icon={Building2}
                      label="Department"
                      value={p.supervisor.department}
                    />
                  )}
                  {p.supervisor.supervisorProfile?.specialization && (
                    <DetailRow
                      icon={Briefcase}
                      label="Specialization"
                      value={p.supervisor.supervisorProfile.specialization}
                    />
                  )}
                </div>

                <Link
                  href="/student/messages"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  Message Supervisor
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-medium text-slate-700">
          {value}
        </p>
      </div>
    </div>
  )
}
