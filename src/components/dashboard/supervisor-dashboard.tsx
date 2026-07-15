"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from "recharts"
import {
  GraduationCap,
  FolderKanban,
  FileText,
  FileCheck,
  MessageCircle,
  TrendingUp,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bell,
  UserCheck,
  ChevronRight,
  Activity,
  CalendarClock,
  MessageSquare,
  Mail,
  Building2,
  Briefcase,
  Users,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { StatsCard } from "@/components/shared/stats-card"
import { SectionCard } from "@/components/shared/section-card"
import { SectionLabel } from "@/components/shared/section-label"
import { ProgressRing } from "@/components/shared/progress-ring"
import { EmptyState } from "@/components/shared/empty-state"
import { DashboardSkeleton } from "@/components/shared/loading-skeleton"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useAuthStore } from "@/stores/auth-store"
import { preferredFirstName } from "@/lib/utils"
import type { ProjectStatus, NotificationType } from "@/types"

interface SupervisorDashboardData {
  supervisor: {
    id: string
    name: string
    email: string
    department: string | null
    avatar: string | null
    specialization: string | null
    bio: string | null
    maxStudents: number
    currentLoad: number
  } | null
  myStudents: number
  activeProjects: number
  completedProjects: number
  pendingReviews: number
  documentsToReview: number
  overdueMilestones: number
  averageStudentProgress: number
  studentsProgress: {
    studentId: string
    studentName: string
    studentMatricNo: string
    projectId: string
    projectTitle: string
    progress: number
    status: ProjectStatus
    lastActivity: string
  }[]
  upcomingDeadlines: {
    id: string
    milestoneName: string
    studentName: string
    dueDate: string | null
    daysUntil: number
    isOverdue: boolean
  }[]
  recentFeedback: {
    id: string
    content: string
    createdAt: string
    student: { name: string }
    document?: { title: string } | null
  }[]
  totalStudents: number
  totalProjects: number
  pendingTopics: number
  totalDocuments: number
  pendingDocuments: number
  totalFeedback: number
  milestonesInProgress: number
  milestonesCompleted: number
  milestonesOverdue: number
  milestonesNotStarted: number
  projects: {
    id: string
    title: string
    progress: number
    status: ProjectStatus
    student: { id: string; name: string }
  }[]
  projectStatusDistribution: { status: ProjectStatus; count: number }[]
  milestoneBreakdown: {
    status: string
    count: number
    color: string
  }[]
  studentProgress: {
    name: string
    fullName: string
    progress: number
    title: string
  }[]
  recentActivities: {
    id: string
    title: string
    message: string
    type: NotificationType
    createdAt: string
    isRead: boolean
  }[]
}

// Green-dominant palette: emerald family for live states, slate for neutral,
// amber/rose only for functionally pending/rejected status.
const statusColors: Record<ProjectStatus, string> = {
  NOT_STARTED: "#cbd5e1",
  IN_PROGRESS: "#10b981",
  SUBMITTED: "#f59e0b",
  APPROVED: "#047857",
  REJECTED: "#fb7185",
}

const statusLabels: Record<ProjectStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

const activityIcon: Partial<Record<NotificationType, typeof Bell>> = {
  TOPIC_SUBMITTED: FileText,
  TOPIC_APPROVED: CheckCircle2,
  TOPIC_REJECTED: AlertTriangle,
  DOCUMENT_UPLOADED: FileText,
  FEEDBACK_GIVEN: MessageCircle,
  MILESTONE_COMPLETED: CheckCircle2,
  MILESTONE_DUE: Clock,
  ALLOCATION_ASSIGNED: UserCheck,
  INFO: Bell,
  SUCCESS: CheckCircle2,
  WARNING: AlertTriangle,
  ERROR: AlertTriangle,
}

function formatDeadlineLabel(d: {
  daysUntil: number
  isOverdue: boolean
}): string {
  if (d.isOverdue) {
    const overdueDays = Math.abs(d.daysUntil)
    return overdueDays === 1
      ? "Overdue by 1 day"
      : `Overdue by ${overdueDays} days`
  }
  if (d.daysUntil === 0) return "Due today"
  if (d.daysUntil === 1) return "Due tomorrow"
  return `${d.daysUntil} days remaining`
}

export default function SupervisorDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery<SupervisorDashboardData>({
    queryKey: ["supervisor-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/supervisor")
      const json = await res.json()
      return json.data
    },
  })

  if (isLoading) return <DashboardSkeleton />
  const d = data!

  // Prefer the profile payload from the API (authoritative — includes
  // department / specialization / capacity). Fall back to the auth store
  // user name for the greeting if the API didn't return a profile.
  const sup = d.supervisor
  const supervisorName = sup?.name ?? user?.name ?? "Professor"
  const firstName = preferredFirstName(supervisorName)

  const avgProgress =
    d.projects.length > 0
      ? Math.round(
          d.projects.reduce((s, p) => s + p.progress, 0) / d.projects.length,
        )
      : d.averageStudentProgress ?? 0

  const totalMilestones =
    d.milestonesCompleted +
    d.milestonesInProgress +
    d.milestonesOverdue +
    d.milestonesNotStarted

  // Capacity utilisation for the supervisor's load card.
  const capacityPct =
    sup && sup.maxStudents > 0
      ? Math.min(100, Math.round((sup.currentLoad / sup.maxStudents) * 100))
      : 0

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────── */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
        {/* Greeting + identity */}
        <div className="flex items-start gap-4">
          {sup && (
            <UserAvatar name={supervisorName} size="xl" />
          )}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
              Supervisor Workspace
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {firstName}
            </h1>
            <p className="text-sm font-medium text-slate-700">
              {supervisorName}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {sup?.department && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                  {sup.department}
                </span>
              )}
              {sup?.specialization && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 text-emerald-500" />
                  {sup.specialization}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-emerald-500" />
                {sup?.email ?? user?.email}
              </span>
            </div>
            <p className="pt-1 text-sm text-slate-500">
              You have{" "}
              <span className="font-semibold text-slate-700">
                {d.totalStudents}
              </span>{" "}
              student{d.totalStudents !== 1 ? "s" : ""} and{" "}
              <span className="font-semibold text-slate-700">
                {d.totalProjects}
              </span>{" "}
              active project{d.totalProjects !== 1 ? "s" : ""} under your
              supervision.
            </p>
          </div>
        </div>

        {/* Supervisor capacity card — mirrors the "Supervisor" email card
            on the student dashboard, but shows load vs max capacity. */}
        {sup && (
          <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm lg:min-w-[280px]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Supervision Capacity
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {sup.currentLoad}
                <span className="text-slate-400"> / {sup.maxStudents}</span>
                <span className="ml-1 text-xs font-normal text-slate-500">
                  students
                </span>
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Overview stats ───────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel
          hint={`${d.activeProjects ?? d.totalProjects} active · ${d.completedProjects ?? 0} completed`}
        >
          Overview
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="My Students"
            value={d.totalStudents}
            icon={GraduationCap}
            delay={0}
          />
          <StatsCard
            title="Active Projects"
            value={d.activeProjects ?? d.totalProjects}
            icon={FolderKanban}
            delay={0.05}
          />
          <StatsCard
            title="Pending Reviews"
            value={d.pendingReviews ?? d.pendingTopics}
            icon={FileCheck}
            delay={0.1}
          />
          <StatsCard
            title="Documents to Review"
            value={d.documentsToReview ?? d.pendingDocuments}
            icon={FileText}
            delay={0.15}
          />
        </div>
      </section>

      {/* ── Progress & Students ──────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint={`${totalMilestones} milestones tracked`}>
          Progress &amp; Students
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Avg progress + milestone stats */}
          <SectionCard
            title="Average Progress"
            description="Across all your active students"
            icon={TrendingUp}
            delay={0.2}
          >
            <div className="flex flex-col items-center">
              <ProgressRing
                percentage={avgProgress}
                size={140}
                label="Complete"
              />
            </div>
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-center">
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {d.milestonesCompleted}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Completed
                </p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 text-center">
                <p className="text-lg font-bold tabular-nums text-amber-700">
                  {d.milestonesInProgress}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">
                  In Progress
                </p>
              </div>
              <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-2.5 text-center">
                <p className="text-lg font-bold tabular-nums text-rose-700">
                  {d.milestonesOverdue}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-rose-600">
                  Overdue
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-center">
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {d.totalFeedback}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Feedback
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Student progress bar chart */}
          <SectionCard
            title="Student Progress"
            description="Per-student completion percentage"
            icon={BarChart}
            delay={0.25}
            className="lg:col-span-2"
            bodyClassName="pt-2"
            action={
              <span className="text-xs text-slate-400">
                {d.projects.length} project
                {d.projects.length !== 1 ? "s" : ""}
              </span>
            }
          >
            {d.studentProgress.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                No active projects yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={d.studentProgress}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as {
                        fullName: string
                        title: string
                        progress: number
                      }
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-sm">
                          <p className="font-semibold text-slate-900">
                            {p.fullName}
                          </p>
                          <p className="mt-0.5 max-w-48 truncate text-slate-500">
                            {p.title}
                          </p>
                          <p className="mt-1 font-bold tabular-nums text-emerald-600">
                            {p.progress}%
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="progress"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    background={{ fill: "#f8fafc", radius: 6 }}
                    maxBarSize={48}
                  >
                    {d.studentProgress.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={
                          entry.progress < 30
                            ? "#fb7185"
                            : entry.progress < 60
                              ? "#f59e0b"
                              : "#10b981"
                        }
                      />
                    ))}
                    <LabelList
                      dataKey="progress"
                      position="top"
                      formatter={(v: number) => `${v}%`}
                      style={{
                        fontSize: 10,
                        fill: "#64748b",
                        fontWeight: 600,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>
      </section>

      {/* ── Insights ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Status & milestone breakdown">
          Insights
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Project status donut */}
          <SectionCard
            title="Project Status Distribution"
            description="All your projects by current status"
            icon={FolderKanban}
            delay={0.3}
          >
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={d.projectStatusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {d.projectStatusDistribution.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={statusColors[entry.status]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                    }}
                    formatter={(value: number, _name, props) => [
                      `${value} project${value !== 1 ? "s" : ""}`,
                      statusLabels[
                        (props.payload as { status: ProjectStatus }).status
                      ],
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid w-full grid-cols-2 gap-2">
                {d.projectStatusDistribution.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: statusColors[s.status] }}
                    />
                    <span className="text-slate-500">
                      {statusLabels[s.status]}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums text-slate-900">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Milestone breakdown */}
          <SectionCard
            title="Milestone Breakdown"
            description="All milestones across your projects"
            icon={ClipboardList}
            delay={0.35}
            action={
              <span className="text-xs text-slate-400">
                {totalMilestones} total
              </span>
            }
          >
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={d.milestoneBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) =>
                    v
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  }
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                  }}
                  formatter={(value: number) => [
                    `${value} milestone${value !== 1 ? "s" : ""}`,
                    "Count",
                  ]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {d.milestoneBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    style={{
                      fontSize: 11,
                      fill: "#64748b",
                      fontWeight: 600,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      </section>

      {/* ── Projects & Activity ──────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Project list & recent events">
          Projects &amp; Activity
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Projects list */}
          <SectionCard
            title="Project Progress"
            description="Your students' projects at a glance"
            icon={ClipboardList}
            delay={0.4}
            flushBody
            action={
              <Link
                href="/supervisor/students"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all
              </Link>
            }
          >
            {d.projects.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No active projects yet
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.projects.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/supervisor/students/${p.student.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-slate-50/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {p.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.student.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tabular-nums text-emerald-600">
                            {p.progress}%
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Recent activity */}
          <SectionCard
            title="Recent Activity"
            description="Notifications from your students"
            icon={Activity}
            delay={0.45}
            flushBody
          >
            {d.recentActivities.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No recent notifications
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.recentActivities.slice(0, 6).map((a) => {
                  const Icon = activityIcon[a.type] ?? Bell
                  return (
                    <li
                      key={a.id}
                      className={`flex gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60 ${
                        !a.isRead ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {a.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                          {a.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(a.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!a.isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </section>

      {/* ── Deadlines & Feedback ─────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Upcoming work & recent comments">
          Deadlines &amp; Feedback
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Upcoming Deadlines */}
          <SectionCard
            title="Upcoming Deadlines"
            description="Milestone due dates for your students"
            icon={CalendarClock}
            delay={0.5}
            flushBody
            action={
              d.overdueMilestones > 0 ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {d.overdueMilestones} overdue
                </span>
              ) : undefined
            }
          >
            {d.upcomingDeadlines.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState
                  icon={CheckCircle2}
                  title="All on track!"
                  description="No upcoming deadlines"
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.upcomingDeadlines.slice(0, 6).map((dl) => {
                  const dotColor = dl.isOverdue
                    ? "bg-rose-500"
                    : dl.daysUntil <= 3
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  const labelColor = dl.isOverdue
                    ? "text-rose-600 font-semibold"
                    : dl.daysUntil <= 3
                      ? "text-amber-600 font-medium"
                      : "text-slate-500"
                  return (
                    <li
                      key={dl.id}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {dl.milestoneName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {dl.studentName}
                        </p>
                        <p className={`mt-0.5 text-xs ${labelColor}`}>
                          {formatDeadlineLabel(dl)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          {/* Recent Feedback */}
          <SectionCard
            title="Recent Feedback"
            description="Comments you've left on student work"
            icon={MessageSquare}
            delay={0.55}
            flushBody
            action={
              <Link
                href="/supervisor/students"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all
              </Link>
            }
          >
            {d.recentFeedback.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState
                  icon={MessageCircle}
                  title="No feedback yet"
                  description="Feedback you write to students will appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.recentFeedback.slice(0, 5).map((fb) => (
                  <li
                    key={fb.id}
                    className="flex gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60"
                  >
                    <UserAvatar name={fb.student.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {fb.student.name}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(fb.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {fb.document?.title && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          On: {fb.document.title}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                        {fb.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </section>

      {/* ── Quick actions ────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Common tasks">Quick Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "My Students",
              description: "View progress & details",
              href: "/supervisor/students",
              icon: GraduationCap,
            },
            {
              label: "Topic Reviews",
              description: `${d.pendingTopics} pending`,
              href: "/supervisor/topics",
              icon: FileCheck,
            },
            {
              label: "Document Reviews",
              description: "Review uploads",
              href: "/supervisor/documents",
              icon: FileText,
            },
            {
              label: "Send Feedback",
              description: "Write to a student",
              href: "/supervisor/students",
              icon: MessageCircle,
            },
          ].map((qa, i) => {
            const Icon = qa.icon
            return (
              <Link
                key={qa.label}
                href={qa.href}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80"
                />
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {qa.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {qa.description}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                  <ChevronRight className="h-3 w-3" />
                </div>
                <span className="sr-only">Quick action {i + 1}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
