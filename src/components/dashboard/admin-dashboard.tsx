"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts"
import {
  GraduationCap,
  UserCheck,
  FolderKanban,
  Clock,
  Activity,
  UserPlus,
  FileCheck,
  FileBarChart,
  Bell,
  FileText,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  TrendingUp,
  ChevronRight,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { StatsCard } from "@/components/shared/stats-card"
import { SectionCard } from "@/components/shared/section-card"
import { SectionLabel } from "@/components/shared/section-label"
import { DashboardSkeleton } from "@/components/shared/loading-skeleton"
import { useAuthStore } from "@/stores/auth-store"
import { preferredFirstName } from "@/lib/utils"
import type {
  ProjectStatus,
  NotificationType,
} from "@/types"

interface AdminData {
  totalStudents: number
  totalSupervisors: number
  totalProjects: number
  projectsInProgress: number
  projectsCompleted: number
  pendingTopics: number
  overdueMilestones: number
  totalDocuments: number
  totalFeedback: number
  activeAllocations: number
  averageProgress: number
  projectStatusDistribution: { status: ProjectStatus; count: number }[]
  supervisorWorkload: {
    supervisorId: string
    name: string
    specialization: string | null
    studentCount: number
    maxStudents: number
    avgProgress: number
  }[]
  recentActivities: {
    id: string
    title: string
    message: string
    type: NotificationType
    createdAt: string
    userName: string
    userRole: string | null
  }[]
}

// Restrained, green-dominant palette. Slate for neutral, emerald family for
// the live states, amber/rose only where the status is functionally
// pending/rejected (semantic, not decorative).
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

export function AdminDashboard() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<AdminData>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/admin")
      const json = await res.json()
      return json.data
    },
  })

  if (isLoading || !data) return <DashboardSkeleton />
  const d = data

  const supervisorBars = d.supervisorWorkload.map((s) => ({
    name: preferredFirstName(s.name),
    fullName: s.name,
    students: s.studentCount,
    avgProgress: s.avgProgress,
  }))

  const totalProjectsInDist = d.projectStatusDistribution.reduce(
    (sum, s) => sum + s.count,
    0,
  )

  const firstName = preferredFirstName(user?.name) ?? "Admin"

  const quickActions = [
    {
      label: "Allocate Supervisors",
      description: "Assign students to supervisors",
      href: "/admin/allocations",
      icon: UserCheck,
      meta: `${d.activeAllocations} active`,
    },
    {
      label: "Review Topics",
      description: "Approve or reject proposals",
      href: "/admin/topics",
      icon: FileCheck,
      meta: d.pendingTopics > 0 ? `${d.pendingTopics} pending` : "All clear",
    },
    {
      label: "Department Overview",
      description: "Charts & analytics",
      href: "/admin/overview",
      icon: FileBarChart,
      meta: "View",
    },
    {
      label: "Add User",
      description: "Create student or supervisor",
      href: "/admin/users",
      icon: UserPlus,
      meta: "New",
    },
  ]

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
            Admin Console
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-slate-500">
            Here&apos;s your department overview for today.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Avg. Progress
            </p>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {d.averageProgress}%
            </p>
          </div>
        </div>
      </header>

      {/* ── Overview stats ───────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint={`${d.totalProjects} projects · ${d.activeAllocations} allocations`}>
          Overview
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Students"
            value={d.totalStudents}
            icon={GraduationCap}
            delay={0}
          />
          <StatsCard
            title="Supervisors"
            value={d.totalSupervisors}
            icon={UserCheck}
            delay={0.05}
          />
          <StatsCard
            title="Active Projects"
            value={d.totalProjects}
            icon={FolderKanban}
            delay={0.1}
          />
          <StatsCard
            title="Pending Reviews"
            value={d.pendingTopics}
            icon={Clock}
            description={
              d.overdueMilestones > 0
                ? `${d.overdueMilestones} overdue milestones`
                : "On schedule"
            }
            delay={0.15}
          />
        </div>
      </section>

      {/* ── Insights ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint={`${totalProjectsInDist} projects tracked`}>
          Insights
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Project Status Distribution */}
          <SectionCard
            title="Project Status Distribution"
            description="Breakdown of all projects by current status"
            icon={PieChart}
            delay={0.2}
            bodyClassName="pt-2"
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={d.projectStatusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {d.projectStatusDistribution.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={statusColors[entry.status]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, item) => [
                      `${value} project${value === 1 ? "" : "s"}`,
                      statusLabels[
                        (item.payload as { status: ProjectStatus }).status
                      ],
                    ]}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.75rem",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
              {d.projectStatusDistribution.map((entry) => (
                <div
                  key={entry.status}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: statusColors[entry.status] }}
                  />
                  <span className="text-slate-500">
                    {statusLabels[entry.status]}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-700">
                    {entry.count}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Supervisor Workload */}
          <SectionCard
            title="Supervisor Workload"
            description="Active student allocations per supervisor"
            icon={BarChart}
            delay={0.25}
            bodyClassName="pt-2"
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={supervisorBars}
                  margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} student${value === 1 ? "" : "s"}`,
                      "Allocated",
                    ]}
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { fullName?: string })
                        ?.fullName ?? ""
                    }
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.75rem",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                    }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar
                    dataKey="students"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  >
                    <LabelList
                      dataKey="students"
                      position="top"
                      style={{
                        fontSize: 11,
                        fill: "#334155",
                        fontWeight: 600,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      </section>

      {/* ── Activity & Actions ───────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Latest events across the department">
          Activity &amp; Actions
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Recent Activity */}
          <SectionCard
            title="Recent Activity"
            description="Latest events across the department"
            icon={Activity}
            delay={0.3}
            className="lg:col-span-2"
            flushBody
          >
            {d.recentActivities.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No recent activity
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.recentActivities.slice(0, 8).map((a) => {
                  const Icon = activityIcon[a.type] ?? Bell
                  return (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {a.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {a.message}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-slate-600">
                          {a.userName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(a.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          {/* Quick Actions */}
          <SectionCard
            title="Quick Actions"
            description="Jump to a common task"
            icon={ChevronRight}
            delay={0.35}
            flushBody
          >
            <ul className="divide-y divide-slate-100">
              {quickActions.map((qa) => {
                const Icon = qa.icon
                return (
                  <li key={qa.href}>
                    <Link
                      href={qa.href}
                      className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-emerald-50/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-700">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {qa.label}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {qa.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {qa.meta}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        </div>
      </section>
    </div>
  )
}
