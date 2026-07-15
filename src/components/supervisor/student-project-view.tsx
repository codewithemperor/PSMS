"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft,
  MessageSquare,
  Plus,
  MoreVertical,
  Play,
  Check,
  Pencil,
  FileText,
  Download,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Send,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ProgressRing } from "@/components/shared/progress-ring"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import type {
  DocumentType,
  FeedbackStatus,
  MilestoneStatus,
  ProjectStatus,
  TopicStatus,
} from "@/types"

// ---------------------------------------------------------------------------
// Response shape (matches GET /api/supervisor/students/[id])
// ---------------------------------------------------------------------------
interface MilestoneRow {
  id: string
  name: string
  description: string | null
  status: MilestoneStatus
  order: number
  weight: number
  dueDate: string | null
  completedDate: string | null
}

interface DocumentRow {
  id: string
  title: string
  fileName: string
  fileSize: number
  fileType: string
  documentType: DocumentType
  version: number
  isFinal: boolean
  createdAt: string
  uploadedBy: { id: string; name: string }
  feedbackCount: number
}

interface FeedbackRow {
  id: string
  content: string
  status: FeedbackStatus
  createdAt: string
  author: { id: string; name: string }
  document: { id: string; title: string } | null
}

interface TopicRow {
  id: string
  title: string
  status: TopicStatus
  submittedAt: string
  reviewedAt: string | null
  reviewerComment: string | null
}

interface StudentProjectViewData {
  student: {
    id: string
    name: string
    email: string
    matricNo: string | null
    department: string | null
    phone: string | null
    avatar: string | null
    createdAt: string
    studentProfile: {
      level: string | null
      programme: string | null
      enrollmentYear: number | null
    } | null
    allocation: {
      academicYear: string
      semester: string
      allocatedAt: string
      allocatedBy: string
    }
  }
  project: {
    id: string
    title: string
    description: string | null
    status: ProjectStatus
    progress: number
    startDate: string | null
    expectedEndDate: string | null
    submittedAt: string | null
    approvedAt: string | null
    milestones: MilestoneRow[]
  } | null
  topics: TopicRow[]
  documents: DocumentRow[]
  feedback: FeedbackRow[]
}

// ---------------------------------------------------------------------------
// Formatters & style maps
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDocType(type: DocumentType): string {
  switch (type) {
    case "LITERATURE_REVIEW":
      return "Literature Review"
    case "DATA_ANALYSIS":
      return "Data Analysis"
    case "FINAL_REPORT":
      return "Final Report"
    default:
      return type
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
  }
}

function formatStatus(status: ProjectStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started"
    case "IN_PROGRESS":
      return "In Progress"
    case "SUBMITTED":
      return "Submitted"
    case "APPROVED":
      return "Approved"
    case "REJECTED":
      return "Rejected"
  }
}

function formatMilestoneStatus(status: MilestoneStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started"
    case "IN_PROGRESS":
      return "In Progress"
    case "COMPLETED":
      return "Completed"
    case "OVERDUE":
      return "Overdue"
  }
}

function formatFeedbackStatus(status: FeedbackStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "ADDRESSED":
      return "Addressed"
    case "DISMISSED":
      return "Dismissed"
  }
}

function formatDateSafe(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return format(d, "MMM d, yyyy")
}

const projectStatusBadgeClass: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
}

const milestoneStatusBadgeClass: Record<MilestoneStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-rose-100 text-rose-700",
}

const milestoneDotClass: Record<MilestoneStatus, string> = {
  NOT_STARTED: "bg-slate-300",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  OVERDUE: "bg-rose-500",
}

const feedbackStatusBadgeClass: Record<FeedbackStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ADDRESSED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-slate-100 text-slate-500",
}

// All known document types in display order
const ALL_DOC_TYPES: DocumentType[] = [
  "PROPOSAL",
  "LITERATURE_REVIEW",
  "METHODOLOGY",
  "DATA_ANALYSIS",
  "DRAFT",
  "FINAL_REPORT",
  "OTHER",
]

// ---------------------------------------------------------------------------
// Milestone form state
// ---------------------------------------------------------------------------
interface MilestoneFormValues {
  name: string
  description: string
  dueDate: string
  order: string
  weight: string
}

const emptyMilestoneForm: MilestoneFormValues = {
  name: "",
  description: "",
  dueDate: "",
  order: "1",
  weight: "10",
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StudentProjectView({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studentId } = use(params)
  const queryClient = useQueryClient()

  const queryKey = useMemo(() => ["supervisor-student", studentId] as const, [
    studentId,
  ])

  const { data, isLoading, error } = useQuery<StudentProjectViewData>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/supervisor/students/${studentId}`,
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load student")
      }
      return json.data as StudentProjectViewData
    },
  })

  // --- Milestone mutations ---------------------------------------------
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ["supervisor-dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["supervisor-students"] })
    queryClient.invalidateQueries({ queryKey: ["supervisor-documents"] })
  }

  // NOTE: Milestone creation (POST /api/projects/[id]/milestones) is
  // intentionally NOT exposed in the UI. Projects receive a fixed set of 5
  // standard milestones (Topic Approval, Proposal Submission, Literature
  // Review, Data Collection & Analysis, Final Report & Submission) at topic-
  // approval time. Supervisors can only adjust the due date and weight of
  // each milestone, and mark non-completed milestones as In Progress or
  // Completed. See editMilestoneMutation + updateMilestoneStatusMutation.

  const updateMilestoneStatusMutation = useMutation({
    mutationFn: async ({
      milestoneId,
      status,
    }: {
      milestoneId: string
      status: MilestoneStatus
    }) => {
      const res = await fetch(
        `/api/milestones/${milestoneId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update milestone")
      }
      return json
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Milestone updated")
      invalidateAll()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const editMilestoneMutation = useMutation({
    mutationFn: async ({
      milestoneId,
      values,
    }: {
      milestoneId: string
      values: MilestoneFormValues
    }) => {
      // Supervisors may only adjust dueDate + weight on a milestone.
      // Name, description and order are fixed (milestones are standard
      // project phases). The PUT endpoint still accepts the full shape for
      // backwards-compat, but we deliberately omit name/description/order.
      const res = await fetch(
        `/api/milestones/${milestoneId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDate: values.dueDate || null,
            weight: Number(values.weight),
          }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update milestone")
      }
      return json
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Milestone updated")
      setEditMilestoneTarget(null)
      invalidateAll()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // --- Feedback mutations ----------------------------------------------
  const docFeedbackMutation = useMutation({
    mutationFn: async ({
      docId,
      content,
    }: {
      docId: string
      content: string
    }) => {
      const res = await fetch(
        `/api/documents/${docId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to submit feedback")
      }
      return json
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Feedback submitted. Student notified.")
      setDocFeedbackTarget(null)
      setDocFeedbackContent("")
      invalidateAll()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const newFeedbackMutation = useMutation({
    mutationFn: async ({
      projectId,
      content,
      documentId,
    }: {
      projectId: string
      content: string
      documentId?: string
    }) => {
      const res = await fetch(`/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          studentId,
          content,
          documentId: documentId || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to submit feedback")
      }
      return json
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Feedback submitted. Student notified.")
      setNewFeedbackOpen(false)
      setNewFeedbackContent("")
      setNewFeedbackDocId("")
      invalidateAll()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // --- UI state --------------------------------------------------------
  // Note: milestone *creation* state was removed — projects get a fixed set
  // of 5 standard milestones at topic-approval time and supervisors can no
  // longer add new ones. Only the edit dialog (date + weight) remains.
  const [editMilestoneTarget, setEditMilestoneTarget] =
    useState<MilestoneRow | null>(null)
  const [editForm, setEditForm] = useState<MilestoneFormValues>(emptyMilestoneForm)

  const [docFeedbackTarget, setDocFeedbackTarget] =
    useState<DocumentRow | null>(null)
  const [docFeedbackContent, setDocFeedbackContent] = useState("")

  const [newFeedbackOpen, setNewFeedbackOpen] = useState(false)
  const [newFeedbackContent, setNewFeedbackContent] = useState("")
  const [newFeedbackDocId, setNewFeedbackDocId] = useState("")

  // --- Loading / error states -----------------------------------------
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load student"
        description={error?.message ?? "The student may not be allocated to you."}
        action={{
          label: "Back to My Students",
          onClick: () => (window.location.href = "/supervisor/students"),
        }}
      />
    )
  }

  const { student, project, topics, documents, feedback } = data

  // If no project yet → show empty state but keep the back button + student header
  if (!project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/supervisor/students">
            <ArrowLeft className="size-4 mr-2" /> Back to My Students
          </Link>
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="rounded-xl border-slate-200/60">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <UserAvatar name={student.name} size="lg" />
                <div>
                  <h1 className="text-xl font-bold text-slate-800">
                    {student.name}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {student.matricNo ?? "—"} ·{" "}
                    {student.department ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <EmptyState
          icon={FileText}
          title="No project yet"
          description="This student hasn't had a topic approved yet. Once a topic is approved, the project, milestones, documents and feedback tabs will appear here."
        />
      </div>
    )
  }

  const milestones = project.milestones
  const completedCount = milestones.filter(
    (m) => m.status === "COMPLETED",
  ).length
  const approvedTopic = topics.find((t) => t.status === "APPROVED") ?? null

  const groupedDocs = ALL_DOC_TYPES.map((type) => ({
    type,
    docs: documents.filter((d) => d.documentType === type),
  })).filter((g) => g.docs.length > 0)

  // --- Handlers --------------------------------------------------------
  const openEditDialog = (m: MilestoneRow) => {
    setEditMilestoneTarget(m)
    setEditForm({
      name: m.name,
      description: m.description ?? "",
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : "",
      order: String(m.order),
      weight: String(m.weight),
    })
  }

  const downloadDoc = (docId: string) => {
    window.open(
      `/api/documents/${docId}/download`,
      "_blank",
    )
  }

  // ---------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/supervisor/students">
          <ArrowLeft className="size-4 mr-2" /> Back to My Students
        </Link>
      </Button>

      {/* Project header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="rounded-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <UserAvatar name={student.name} size="lg" />
                <div>
                  <h1 className="text-xl font-bold text-slate-800">
                    {project.title}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {student.name} · {student.matricNo ?? "—"} ·{" "}
                    {student.department ?? "—"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      className={projectStatusBadgeClass[project.status]}
                    >
                      {formatStatus(project.status)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Started{" "}
                      {formatDateSafe(project.startDate) ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ProgressRing
                  percentage={project.progress}
                  size={72}
                  strokeWidth={6}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  asChild
                >
                  <Link href="/supervisor/messages">
                    <MessageSquare className="size-4 mr-2" /> Message
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-slate-100 rounded-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        {/* ---------- Overview tab ---------- */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="rounded-xl border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700">
                  Project Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  {project.description || "No description provided."}
                </p>
                {approvedTopic && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-xs font-medium text-emerald-700 mb-1">
                      Approved Topic
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {approvedTopic.title}
                    </p>
                    {approvedTopic.reviewerComment && (
                      <p className="text-xs text-slate-500 mt-1">
                        {approvedTopic.reviewerComment}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="rounded-xl border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700">
                  Key Dates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {milestones.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">
                    No milestones have been added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {milestones.map((m) => {
                      const completed = m.completedDate
                        ? formatDateSafe(m.completedDate)
                        : null
                      const due = m.dueDate
                        ? formatDateSafe(m.dueDate)
                        : null
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3"
                        >
                          {m.status === "COMPLETED" ? (
                            <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                          ) : m.status === "OVERDUE" ? (
                            <XCircle className="size-5 text-rose-500 shrink-0" />
                          ) : (
                            <Circle className="size-5 text-slate-300 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {m.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {completed
                                ? `Completed ${completed}`
                                : due
                                  ? `Due ${due}`
                                  : "No date set"}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ---------- Milestones tab ---------- */}
        <TabsContent value="milestones" className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {completedCount}/{milestones.length} milestones completed
            </p>
            <span className="text-xs text-slate-400">
              Fixed project phases · edit date &amp; weight only
            </span>
          </div>

          <Progress value={project.progress} className="h-3" />

          <div className="space-y-3">
            {milestones.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No milestones yet"
                description="Milestones are created automatically when a topic is approved."
              />
            ) : (
              milestones.map((m, idx) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="rounded-lg border-slate-200/60">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "size-3 rounded-full shrink-0",
                            milestoneDotClass[m.status],
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {m.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {m.description || "No description"} · Weight:{" "}
                            {m.weight}%
                          </p>
                          <p className="text-xs text-slate-400">
                            {m.dueDate &&
                              `Due: ${formatDateSafe(m.dueDate) ?? "—"}`}
                            {m.dueDate && m.completedDate ? " · " : ""}
                            {m.completedDate &&
                              `Completed: ${formatDateSafe(m.completedDate) ?? "—"}`}
                            {!m.dueDate && !m.completedDate && "No dates set"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          className={milestoneStatusBadgeClass[m.status]}
                        >
                          {formatMilestoneStatus(m.status)}
                        </Badge>
                        {/* COMPLETED milestones are locked — no edit, no status
                            changes. Supervisors can only adjust date & weight
                            on non-completed milestones. */}
                        {m.status !== "COMPLETED" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {m.status === "NOT_STARTED" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateMilestoneStatusMutation.mutate({
                                      milestoneId: m.id,
                                      status: "IN_PROGRESS",
                                    })
                                  }
                                >
                                  <Play className="size-4 mr-2" /> Mark In
                                  Progress
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMilestoneStatusMutation.mutate({
                                    milestoneId: m.id,
                                    status: "COMPLETED",
                                  })
                                }
                              >
                                <Check className="size-4 mr-2" /> Mark Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditDialog(m)}
                              >
                                <Pencil className="size-4 mr-2" /> Edit Date
                                &amp; Weight
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            Locked
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ---------- Documents tab ---------- */}
        <TabsContent value="documents" className="mt-6 space-y-4">
          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="The student hasn't uploaded any documents."
            />
          ) : (
            groupedDocs.map((group) => (
              <div key={group.type} className="mb-2">
                <h3 className="text-sm font-medium text-slate-700 mb-3">
                  {formatDocType(group.type)}
                </h3>
                <div className="space-y-2">
                  {group.docs.map((doc) => (
                    <Card
                      key={doc.id}
                      className="rounded-lg border-slate-200/60 hover:shadow-sm transition"
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <FileText className="size-5 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {doc.title}
                            </p>
                            <p className="text-xs text-slate-400">
                              Version {doc.version} ·{" "}
                              {formatFileSize(doc.fileSize)} ·{" "}
                              {formatDateSafe(doc.createdAt) ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc.feedbackCount > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-200"
                            >
                              {doc.feedbackCount} feedback
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              New
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadDoc(doc.id)}
                            aria-label={`Download ${doc.title}`}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs"
                            onClick={() => {
                              setDocFeedbackTarget(doc)
                              setDocFeedbackContent("")
                            }}
                          >
                            <MessageCircle className="size-3.5 mr-1" /> Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ---------- Feedback tab ---------- */}
        <TabsContent value="feedback" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              onClick={() => {
                setNewFeedbackOpen(true)
                setNewFeedbackContent("")
                setNewFeedbackDocId("")
              }}
            >
              <Plus className="size-4 mr-1" /> Give Feedback
            </Button>
          </div>

          {feedback.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No feedback yet"
              description="Give feedback to help the student improve."
            />
          ) : (
            <div className="space-y-3">
              {feedback.map((fb, idx) => (
                <motion.div
                  key={fb.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="rounded-lg border-slate-200/60">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {fb.document && (
                            <p className="text-xs text-slate-400 mb-1">
                              On: {fb.document.title}
                            </p>
                          )}
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">
                            {fb.content}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {formatDateSafe(fb.createdAt) ?? "—"}
                          </p>
                        </div>
                        <Badge
                          className={feedbackStatusBadgeClass[fb.status]}
                        >
                          {formatFeedbackStatus(fb.status)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- Edit Milestone Dialog (date + weight only) ----------
          Milestones are fixed project phases. Supervisors may only adjust the
          due date and the weight (points) of a milestone. Name, description
          and order are not editable. Completed milestones cannot be edited
          at all (the action menu is hidden for them). */}
      <Dialog
        open={!!editMilestoneTarget}
        onOpenChange={(open) => {
          if (!open) setEditMilestoneTarget(null)
        }}
      >
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              Edit Milestone
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Adjust the due date and weight for{" "}
              <span className="font-medium text-slate-700">
                {editMilestoneTarget?.name}
              </span>
              . The milestone name and description are fixed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Read-only name (for context) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Milestone
              </Label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {editMilestoneTarget?.name}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ed-due" className="text-sm text-slate-700">
                  Due Date
                </Label>
                <Input
                  id="ed-due"
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-weight" className="text-sm text-slate-700">
                  Weight (1-100)
                </Label>
                <Input
                  id="ed-weight"
                  type="number"
                  min={1}
                  max={100}
                  value={editForm.weight}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, weight: e.target.value }))
                  }
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs leading-relaxed text-emerald-800">
                <span className="font-semibold">Note:</span> Project progress is
                recalculated from milestone weights. Changing the weight will
                update the overall completion percentage.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMilestoneTarget(null)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              disabled={editMilestoneMutation.isPending}
              onClick={() => {
                if (editMilestoneTarget) {
                  editMilestoneMutation.mutate({
                    milestoneId: editMilestoneTarget.id,
                    values: editForm,
                  })
                }
              }}
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {editMilestoneMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              <Check className="mr-1.5 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Document Feedback Dialog ---------- */}
      <Dialog
        open={!!docFeedbackTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDocFeedbackTarget(null)
            setDocFeedbackContent("")
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              Review Document
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Your feedback will be sent to {student.name} and they will be
              notified.
            </DialogDescription>
          </DialogHeader>
          {docFeedbackTarget && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">
                {docFeedbackTarget.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Version {docFeedbackTarget.version} ·{" "}
                {formatDocType(docFeedbackTarget.documentType)}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="doc-fb" className="text-sm text-slate-700">
              Your feedback <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="doc-fb"
              value={docFeedbackContent}
              onChange={(e) => setDocFeedbackContent(e.target.value)}
              placeholder="e.g. The introduction is well-structured. Consider expanding the literature review..."
              rows={6}
              className="rounded-lg"
            />
            <p className="text-xs text-slate-400">
              {docFeedbackContent.trim().length}/10 minimum characters
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDocFeedbackTarget(null)
                setDocFeedbackContent("")
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              disabled={
                docFeedbackContent.trim().length < 10 ||
                docFeedbackMutation.isPending ||
                !docFeedbackTarget
              }
              onClick={() => {
                if (docFeedbackTarget) {
                  docFeedbackMutation.mutate({
                    docId: docFeedbackTarget.id,
                    content: docFeedbackContent.trim(),
                  })
                }
              }}
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {docFeedbackMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              <Send className="mr-1.5 h-4 w-4" />
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- New Feedback Dialog (Feedback tab) ---------- */}
      <Dialog
        open={newFeedbackOpen}
        onOpenChange={(open) => {
          setNewFeedbackOpen(open)
          if (!open) {
            setNewFeedbackContent("")
            setNewFeedbackDocId("")
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              New Feedback
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Give general feedback to {student.name}. You can optionally
              attach it to a document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fb-doc" className="text-sm text-slate-700">
                Document (optional)
              </Label>
              <Select
                value={newFeedbackDocId || "__none__"}
                onValueChange={(v) =>
                  setNewFeedbackDocId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger id="fb-doc" className="rounded-lg w-full">
                  <SelectValue placeholder="No specific document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    No specific document
                  </SelectItem>
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-content" className="text-sm text-slate-700">
                Your feedback <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="fb-content"
                value={newFeedbackContent}
                onChange={(e) => setNewFeedbackContent(e.target.value)}
                placeholder="Write constructive feedback for the student..."
                rows={6}
                className="rounded-lg"
              />
              <p className="text-xs text-slate-400">
                {newFeedbackContent.trim().length}/10 minimum characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFeedbackOpen(false)
                setNewFeedbackContent("")
                setNewFeedbackDocId("")
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              disabled={
                newFeedbackContent.trim().length < 10 ||
                newFeedbackMutation.isPending
              }
              onClick={() =>
                newFeedbackMutation.mutate({
                  projectId: project.id,
                  content: newFeedbackContent.trim(),
                  documentId: newFeedbackDocId || undefined,
                })
              }
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {newFeedbackMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              <Send className="mr-1.5 h-4 w-4" />
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
