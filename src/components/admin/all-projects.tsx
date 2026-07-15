"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { format, formatDistanceToNow } from "date-fns"
import {
  FolderKanban,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  UserCheck,
  Flag,
  FileText,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatsCard } from "@/components/shared/stats-card"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import type { ProjectStatus, MilestoneStatus } from "@/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StudentInfo {
  id: string
  name: string
  email: string
  matricNo: string | null
  department: string | null
}

interface SupervisorInfo {
  id: string
  name: string
}

interface ProjectRow {
  id: string
  title: string
  description: string | null
  status: ProjectStatus
  progress: number
  startDate: string | null
  expectedEndDate: string | null
  submittedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  student: StudentInfo
  supervisor: SupervisorInfo
  _count: { milestones: number; documents: number; feedback: number }
  milestoneStats: { completed: number; total: number }
}

interface StatusCounts {
  NOT_STARTED: number
  IN_PROGRESS: number
  SUBMITTED: number
  APPROVED: number
  REJECTED: number
}

interface ProjectsResponse {
  success: boolean
  data: ProjectRow[]
  statusCounts: StatusCounts
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface SupervisorOption {
  id: string
  name: string
}

// Detail-dialog payload — comes from /api/projects/[id]
interface MilestoneDetail {
  id: string
  name: string
  description: string | null
  status: MilestoneStatus
  order: number
  weight: number
  dueDate: string | null
  completedDate: string | null
}

interface ProjectDetail {
  id: string
  title: string
  description: string | null
  status: ProjectStatus
  progress: number
  startDate: string | null
  expectedEndDate: string | null
  submittedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  student: StudentInfo & {
    studentProfile?: {
      level: string | null
      programme: string | null
      enrollmentYear: number | null
    } | null
  }
  supervisor: SupervisorInfo & {
    email?: string
    department?: string | null
    supervisorProfile?: {
      specialization: string | null
      bio: string | null
    } | null
  }
  topics: {
    id: string
    title: string
    status: string
    reviewerComment: string | null
    createdAt: string
  }[]
  documents: {
    id: string
    title: string
    documentType: string
    version: number
    isFinal: boolean
    createdAt: string
    _count: { feedback: number }
  }[]
  milestones: MilestoneDetail[]
  feedback: {
    id: string
    content: string
    status: string
    createdAt: string
    author: { id: string; name: string }
  }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusBadgeClass: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 border-slate-200",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUBMITTED: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-teal-100 text-teal-700 border-teal-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
}

function formatStatus(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "MMM d, yyyy")
  } catch {
    return "—"
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
  } catch {
    return "—"
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return "—"
  }
}

// Tailwind class to recolor the Progress indicator (default is primary=black).
function progressIndicatorClass(p: number): string {
  if (p < 30) return "[&>div]:bg-rose-500"
  if (p < 60) return "[&>div]:bg-amber-500"
  if (p < 100) return "[&>div]:bg-emerald-500"
  return "[&>div]:bg-teal-500"
}

const milestoneDotClass: Record<MilestoneStatus, string> = {
  NOT_STARTED: "bg-slate-300",
  IN_PROGRESS: "bg-amber-400",
  COMPLETED: "bg-emerald-500",
  OVERDUE: "bg-rose-500",
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  searchInput: string
  onSearchChange: (v: string) => void
  status: "ALL" | ProjectStatus
  onStatusChange: (v: "ALL" | ProjectStatus) => void
  supervisorId: "ALL" | string
  onSupervisorChange: (v: "ALL" | string) => void
  supervisors: SupervisorOption[]
  supervisorsLoading: boolean
  resultCount: number
  totalCount: number
}

function FilterBar({
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  supervisorId,
  onSupervisorChange,
  supervisors,
  supervisorsLoading,
  resultCount,
  totalCount,
}: FilterBarProps) {
  return (
    <Card className="rounded-xl border-slate-200/60 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by title, student, or supervisor…"
              className="rounded-lg pl-9"
              aria-label="Search projects"
            />
          </div>

          {/* Status filter */}
          <Select
            value={status}
            onValueChange={(v) =>
              onStatusChange(v as "ALL" | ProjectStatus)
            }
          >
            <SelectTrigger
              className="h-9 w-full min-w-[160px] rounded-lg sm:w-auto"
              aria-label="Filter by status"
            >
              <Filter className="mr-1 h-3.5 w-3.5 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Supervisor filter */}
          <Select
            value={supervisorId}
            onValueChange={(v) => onSupervisorChange(v as "ALL" | string)}
          >
            <SelectTrigger
              className="h-9 w-full min-w-[180px] rounded-lg sm:w-auto"
              aria-label="Filter by supervisor"
            >
              <UserCheck className="mr-1 h-3.5 w-3.5 text-slate-400" />
              <SelectValue placeholder="Supervisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All supervisors</SelectItem>
              {supervisorsLoading ? (
                <SelectItem value="ALL" disabled>
                  Loading…
                </SelectItem>
              ) : (
                supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Result count line */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{resultCount}</span>
          <span>of</span>
          <span className="font-medium text-slate-600">{totalCount}</span>
          <span>projects</span>
          {(status !== "ALL" ||
            supervisorId !== "ALL" ||
            searchInput.trim() !== "") && (
            <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              filtered
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

function StatsRow({ counts }: { counts: StatusCounts }) {
  const total =
    counts.NOT_STARTED +
    counts.IN_PROGRESS +
    counts.SUBMITTED +
    counts.APPROVED +
    counts.REJECTED
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        title="Total Projects"
        value={total}
        icon={FolderKanban}
        tone="slate"
        description="All projects in department"
        delay={0}
      />
      <StatsCard
        title="In Progress"
        value={counts.IN_PROGRESS}
        icon={Activity}
        tone="emerald"
        description="Active supervision"
        delay={0.05}
      />
      <StatsCard
        title="Submitted"
        value={counts.SUBMITTED}
        icon={FileText}
        tone="amber"
        description="Awaiting review"
        delay={0.1}
      />
      <StatsCard
        title="Approved"
        value={counts.APPROVED}
        icon={CheckCircle2}
        tone="teal"
        description="Completed & approved"
        delay={0.15}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onView,
  index,
}: {
  project: ProjectRow
  onView: (p: ProjectRow) => void
  index: number
}) {
  const { milestoneStats } = project
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card className="group flex h-full flex-col rounded-xl border-slate-200/60 transition-shadow hover:shadow-md">
        <CardHeader className="gap-2 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle
              className="line-clamp-2 text-base leading-snug text-slate-800"
              title={project.title}
            >
              {project.title}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 whitespace-nowrap",
                statusBadgeClass[project.status],
              )}
            >
              {formatStatus(project.status)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3">
          {/* Description */}
          {project.description && (
            <p className="line-clamp-2 text-xs text-slate-500">
              {project.description}
            </p>
          )}

          {/* Student + Supervisor */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="font-medium text-slate-700">
                {project.student.name}
              </span>
              {project.student.matricNo && (
                <span className="text-slate-400">
                  · {project.student.matricNo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <UserCheck className="h-3.5 w-3.5 shrink-0 text-teal-500" />
              <span className="text-slate-600">
                {project.supervisor.name}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Progress</span>
              <span className="font-semibold text-slate-700">
                {project.progress}%
              </span>
            </div>
            <Progress
              value={project.progress}
              className={cn("h-1.5", progressIndicatorClass(project.progress))}
            />
          </div>

          {/* Milestone stats */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Flag className="h-3.5 w-3.5 text-amber-500" />
            <span>
              <span className="font-semibold text-slate-700">
                {milestoneStats.completed}
              </span>
              <span className="text-slate-400">
                {" "}
                / {milestoneStats.total} milestones
              </span>
            </span>
          </div>

          {/* Dates */}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created {formatDate(project.createdAt)}
            </span>
            {project.expectedEndDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due {formatDate(project.expectedEndDate)}
              </span>
            )}
          </div>

          {/* Action */}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full rounded-lg border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={() => onView(project)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View Details
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons + states
// ---------------------------------------------------------------------------

function ProjectCardSkeleton() {
  return (
    <Card className="flex h-full flex-col rounded-xl border-slate-200/60">
      <CardHeader className="gap-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-50" />
        <div className="space-y-1.5">
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-50" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-50" />
        </div>
        <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-50" />
        <div className="mt-2 h-8 w-full animate-pulse rounded-lg bg-slate-100" />
      </CardContent>
    </Card>
  )
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="rounded-xl border-slate-200/60">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="h-10 w-10 text-rose-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">
          Failed to load projects
        </p>
        <p className="text-xs text-slate-400">
          Something went wrong while fetching data.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-lg"
          onClick={onRetry}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Detail dialog
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Calendar
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-sm text-slate-700">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

function ProjectDetailDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRow | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  // Fetch full detail only when the dialog is open.
  const { data, isLoading, isError, refetch } = useQuery<ProjectDetail>({
    queryKey: ["project-detail", project?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${project!.id}`,
      )
      if (!res.ok) throw new Error("Failed to fetch project detail")
      const json = await res.json()
      return json.data.project as ProjectDetail
    },
    enabled: !!project && open,
    staleTime: 60_000,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-4">
          <DialogTitle className="text-lg text-slate-800">
            {project?.title ?? "Project details"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Full project information, milestones, documents and feedback.
          </DialogDescription>
        </DialogHeader>

        {project && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-2.5">
            <Badge
              variant="outline"
              className={cn(statusBadgeClass[project.status])}
            >
              {formatStatus(project.status)}
            </Badge>
            <span className="text-xs text-slate-500">
              {project.progress}% complete
            </span>
            <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3" />
                {project.milestoneStats.completed}/{project.milestoneStats.total} milestones
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {project._count.documents} docs
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {project._count.feedback} feedback
              </span>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[calc(90vh-12rem)]">
          <div className="px-6 py-4">
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            )}

            {isError && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-8 w-8 text-rose-300" />
                <p className="mt-2 text-sm font-medium text-slate-600">
                  Failed to load project detail
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
                </Button>
              </div>
            )}

            {data && !isLoading && !isError && (
              <div className="space-y-6">
                {/* Description */}
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {data.description || (
                      <span className="italic text-slate-400">
                        No description provided.
                      </span>
                    )}
                  </p>
                </section>

                {/* People */}
                <section className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Student
                    </h4>
                    <div className="flex items-start gap-2 py-1">
                      <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">
                          {data.student.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {data.student.email}
                        </p>
                        <p className="text-xs text-slate-400">
                          {[
                            data.student.matricNo,
                            data.student.department,
                            data.student.studentProfile?.level,
                            data.student.studentProfile?.programme,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Supervisor
                    </h4>
                    <div className="flex items-start gap-2 py-1">
                      <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">
                          {data.supervisor.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {data.supervisor.email}
                        </p>
                        {data.supervisor.supervisorProfile
                          ?.specialization && (
                          <p className="text-xs text-slate-400">
                            {
                              data.supervisor.supervisorProfile
                                .specialization
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Timeline */}
                <section>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Timeline
                  </h4>
                  <div className="divide-y divide-slate-50">
                    <DetailRow
                      icon={Calendar}
                      label="Created"
                      value={formatDateTime(data.createdAt)}
                      sub={formatRelative(data.createdAt)}
                    />
                    {data.startDate && (
                      <DetailRow
                        icon={Activity}
                        label="Start date"
                        value={formatDate(data.startDate)}
                      />
                    )}
                    {data.expectedEndDate && (
                      <DetailRow
                        icon={Clock}
                        label="Expected end date"
                        value={formatDate(data.expectedEndDate)}
                      />
                    )}
                    {data.submittedAt && (
                      <DetailRow
                        icon={FileText}
                        label="Submitted"
                        value={formatDateTime(data.submittedAt)}
                        sub={formatRelative(data.submittedAt)}
                      />
                    )}
                    {data.approvedAt && (
                      <DetailRow
                        icon={CheckCircle2}
                        label="Approved"
                        value={formatDateTime(data.approvedAt)}
                        sub={formatRelative(data.approvedAt)}
                      />
                    )}
                  </div>
                </section>

                {/* Milestones */}
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Milestones ({data.milestones.length})
                  </h4>
                  <div className="space-y-1.5">
                    {data.milestones.length === 0 && (
                      <p className="text-xs italic text-slate-400">
                        No milestones recorded.
                      </p>
                    )}
                    {data.milestones.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2"
                      >
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            milestoneDotClass[m.status],
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-slate-700">
                              {m.name}
                            </p>
                            <span className="text-[11px] font-medium text-slate-400">
                              {m.weight}%
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                            <span className="rounded bg-white px-1.5 py-0.5 font-medium uppercase tracking-wide text-slate-500">
                              {formatStatus(m.status)}
                            </span>
                            {m.dueDate && (
                              <span>Due {formatDate(m.dueDate)}</span>
                            )}
                            {m.completedDate && (
                              <span className="text-emerald-600">
                                Done {formatDate(m.completedDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Documents */}
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Documents ({data.documents.length})
                  </h4>
                  {data.documents.length === 0 ? (
                    <p className="text-xs italic text-slate-400">
                      No documents uploaded yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.documents.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-700">
                              {d.title}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {d.documentType.replace(/_/g, " ").toLowerCase()} ·
                              v{d.version} · {formatDate(d.createdAt)}
                              {d.isFinal && (
                                <span className="ml-1.5 rounded bg-teal-50 px-1.5 py-0.5 font-medium text-teal-700">
                                  Final
                                </span>
                              )}
                            </p>
                          </div>
                          {d._count.feedback > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MessageSquare className="h-3 w-3" />
                              {d._count.feedback}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Feedback */}
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feedback ({data.feedback.length})
                  </h4>
                  {data.feedback.length === 0 ? (
                    <p className="text-xs italic text-slate-400">
                      No feedback recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.feedback.map((f) => (
                        <div
                          key={f.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-600">
                              {f.author.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatRelative(f.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {f.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (p: number) => void
}) {
  if (total === 0) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        Showing{" "}
        <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg"
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
        </Button>
        <span className="text-xs text-slate-500">
          Page <span className="font-medium text-slate-700">{page}</span> of{" "}
          <span className="font-medium text-slate-700">{totalPages}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg"
        >
          Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 12

export function AllProjects() {
  // Filter state
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"ALL" | ProjectStatus>("ALL")
  const [supervisorId, setSupervisorId] = useState<"ALL" | string>("ALL")
  const [page, setPage] = useState(1)

  // Detail dialog state
  const [detailTarget, setDetailTarget] = useState<ProjectRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Debounce the search input (300ms) before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Build query string for the projects endpoint.
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("XTransformPort", "3000")
    if (status !== "ALL") params.set("status", status)
    if (supervisorId !== "ALL") params.set("supervisorId", supervisorId)
    if (search.trim()) params.set("search", search.trim())
    params.set("page", String(page))
    params.set("limit", String(PAGE_LIMIT))
    return params.toString()
  }, [status, supervisorId, search, page])

  // Fetch projects.
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<ProjectsResponse>({
    queryKey: ["admin-projects", status, supervisorId, search, page],
    queryFn: async () => {
      const res = await fetch(`/api/projects?${queryString}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to fetch projects")
      }
      return (await res.json()) as ProjectsResponse
    },
    placeholderData: (prev) => prev,
  })

  // Fetch supervisors for the filter dropdown.
  const { data: supervisorsData, isLoading: supervisorsLoading } = useQuery<{
    data: SupervisorOption[]
  }>({
    queryKey: ["supervisors"],
    queryFn: async () => {
      const res = await fetch("/api/supervisors")
      if (!res.ok) throw new Error("Failed to fetch supervisors")
      return await res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const projects = data?.data ?? []
  const statusCounts: StatusCounts =
    data?.statusCounts ?? {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      REJECTED: 0,
    }
  const pagination = data?.pagination
  const liveTotal = pagination?.total ?? 0

  function handleView(p: ProjectRow) {
    setDetailTarget(p)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">All Projects</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {liveTotal} live
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Browse, filter, and review every project across the department.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={cn(
              "mr-1.5 h-3.5 w-3.5",
              isFetching && "animate-spin",
            )}
          />
          Refresh
        </Button>
      </motion.div>

      {/* Stats */}
      <StatsRow counts={statusCounts} />

      {/* Filter bar */}
      <FilterBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        supervisorId={supervisorId}
        onSupervisorChange={(v) => {
          setSupervisorId(v)
          setPage(1)
        }}
        supervisors={supervisorsData?.data ?? []}
        supervisorsLoading={supervisorsLoading}
        resultCount={projects.length}
        totalCount={liveTotal}
      />

      {/* Projects grid */}
      {isLoading ? (
        <ProjectsSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : projects.length === 0 ? (
        <Card className="rounded-xl border-slate-200/60">
          <CardContent className="py-6">
            <EmptyState
              icon={FolderKanban}
              title="No projects found"
              description={
                search.trim() ||
                status !== "ALL" ||
                supervisorId !== "ALL"
                  ? "Try adjusting your filters or search query."
                  : "There are no projects in the department yet."
              }
              action={
                search.trim() ||
                status !== "ALL" ||
                supervisorId !== "ALL"
                  ? {
                      label: "Clear filters",
                      onClick: () => {
                        setSearchInput("")
                        setStatus("ALL")
                        setSupervisorId("ALL")
                      },
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                onView={handleView}
                index={i}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && (
            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Detail dialog */}
      <ProjectDetailDialog
        project={detailTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
