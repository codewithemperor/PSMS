"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { motion } from "framer-motion"
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
  FolderKanban,
  FileText,
  MessageCircle,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Upload,
  Activity,
  ChevronRight,
  GraduationCap,
  Mail,
  Briefcase,
  CalendarDays,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { StatsCard } from "@/components/shared/stats-card"
import { SectionCard } from "@/components/shared/section-card"
import { SectionLabel } from "@/components/shared/section-label"
import { ProgressRing } from "@/components/shared/progress-ring"
import { DashboardSkeleton } from "@/components/shared/loading-skeleton"
import {
  TopicStatePanel,
  type LatestTopicInfo,
} from "@/components/student/topic-state-panel"
import { useAuthStore } from "@/stores/auth-store"
import { preferredFirstName } from "@/lib/utils"
import type {
  MilestoneStatus,
  ProjectStatus,
  TopicStatus,
  NotificationType,
} from "@/types"

interface StudentData {
  project: {
    id: string
    title: string
    description: string | null
    status: ProjectStatus
    progress: number
    startDate: string | null
    expectedEndDate: string | null
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
    }[]
    topics: {
      id: string
      title: string
      status: TopicStatus
      reviewerComment: string | null
    }[]
    documents: {
      id: string
      title: string
      fileName: string
      documentType: string
      createdAt: string
    }[]
    feedback: {
      id: string
      content: string
      status: string
      createdAt: string
      author: { name: string }
    }[]
  } | null
  latestTopic: LatestTopicInfo | null
  pendingFeedbackCount: number
  unreadNotifications: number
  hasProject: boolean
  milestoneBreakdown: { status: string; count: number; color: string }[]
  documentTypeDistribution: { type: string; count: number }[]
  totalMilestones: number
  completedMilestones: number
  recentActivities: {
    id: string
    title: string
    message: string
    type: NotificationType
    createdAt: string
    isRead: boolean
    link: string | null
  }[]
}

const milestoneStatusStyle: Record<
  MilestoneStatus,
  { dot: string; text: string; label: string }
> = {
  NOT_STARTED: {
    dot: "bg-slate-300",
    text: "text-slate-500",
    label: "Not Started",
  },
  IN_PROGRESS: {
    dot: "bg-amber-500",
    text: "text-amber-600",
    label: "In Progress",
  },
  COMPLETED: {
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    label: "Completed",
  },
  OVERDUE: { dot: "bg-rose-500", text: "text-rose-600", label: "Overdue" },
}

const topicStatusBadge: Record<TopicStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  REVISION_REQUIRED: "bg-orange-100 text-orange-700",
}

const activityIcon: Partial<Record<NotificationType, typeof Bell>> = {
  TOPIC_SUBMITTED: FileText,
  TOPIC_APPROVED: CheckCircle2,
  TOPIC_REJECTED: AlertCircle,
  DOCUMENT_UPLOADED: FileText,
  FEEDBACK_GIVEN: MessageCircle,
  MILESTONE_COMPLETED: CheckCircle2,
  MILESTONE_DUE: Clock,
  ALLOCATION_ASSIGNED: GraduationCap,
  INFO: Bell,
  SUCCESS: CheckCircle2,
  WARNING: AlertCircle,
  ERROR: AlertCircle,
}

// Document type colours — emerald family for the academic doc types, slate
// for drafts/other. Kept restrained and green-dominant.
const docTypeColors: Record<string, string> = {
  PROPOSAL: "#10b981",
  DRAFT: "#94a3b8",
  LITERATURE_REVIEW: "#14b8a6",
  METHODOLOGY: "#0d9488",
  DATA_ANALYSIS: "#059669",
  FINAL_REPORT: "#047857",
  OTHER: "#cbd5e1",
}

const docTypeLabels: Record<string, string> = {
  PROPOSAL: "Proposal",
  DRAFT: "Draft",
  LITERATURE_REVIEW: "Literature Review",
  METHODOLOGY: "Methodology",
  DATA_ANALYSIS: "Data Analysis",
  FINAL_REPORT: "Final Report",
  OTHER: "Other",
}

const quickActions = [
  {
    label: "Submit Topic",
    description: "Propose a new topic",
    href: "/student/topic",
    icon: FileCheck,
  },
  {
    label: "Upload Document",
    description: "Share your work",
    href: "/student/upload",
    icon: Upload,
  },
  {
    label: "View Feedback",
    description: "Read supervisor notes",
    href: "/student/feedback",
    icon: MessageCircle,
  },
  {
    label: "My Project",
    description: "Full project view",
    href: "/student/project",
    icon: FolderKanban,
  },
]

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<StudentData>({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/student")
      const json = await res.json()
      return json.data
    },
  })

  if (isLoading) return <DashboardSkeleton />
  const d = data!

  if (!d.hasProject || !d.project) {
    return (
      <div className="space-y-8">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
            Student Workspace
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hi, {preferredFirstName(user?.name)}!
          </h1>
          <p className="text-sm text-slate-500">
            {d.latestTopic
              ? "Here&apos;s where your topic submission stands."
              : "Submit a project topic to get started."}
          </p>
        </header>
        <TopicStatePanel topic={d.latestTopic} context="dashboard" />
      </div>
    )
  }

  const p = d.project
  const completedMilestones = p.milestones.filter(
    (m) => m.status === "COMPLETED",
  ).length

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
            Student Workspace
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hi, {preferredFirstName(user?.name)}!
          </h1>
          <p className="text-sm text-slate-500">
            Supervisor:{" "}
            <Link
              href="/student/messages"
              className="font-semibold text-emerald-600 hover:text-emerald-700"
            >
              {p.supervisor.name}
            </Link>
            {p.supervisor.supervisorProfile?.specialization && (
              <span className="text-slate-400">
                {" "}
                · {p.supervisor.supervisorProfile.specialization}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Supervisor
            </p>
            <p className="truncate text-xs font-medium text-slate-700">
              {p.supervisor.email}
            </p>
          </div>
        </div>
      </header>

      {/* ── Overview stats ───────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel
          hint={`${completedMilestones}/${p.milestones.length} milestones done`}
        >
          Overview
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Project Progress"
            value={`${p.progress}%`}
            icon={TrendingUp}
            delay={0}
          />
          <StatsCard
            title="Milestones"
            value={`${completedMilestones}/${p.milestones.length}`}
            icon={CheckCircle2}
            delay={0.05}
          />
          <StatsCard
            title="Documents"
            value={p.documents.length}
            icon={FileText}
            delay={0.1}
          />
          <StatsCard
            title="Pending Feedback"
            value={d.pendingFeedbackCount}
            icon={MessageCircle}
            delay={0.15}
          />
        </div>
      </section>

      {/* ── Progress & Milestones ────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Your project status & roadmap">
          Progress &amp; Milestones
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Progress ring + project meta */}
          <SectionCard
            title="Your Progress"
            description="Overall project completion"
            icon={TrendingUp}
            delay={0.2}
          >
            <div className="flex flex-col items-center">
              <ProgressRing
                percentage={p.progress}
                size={140}
                label="Complete"
              />
            </div>
            <dl className="mt-5 w-full space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-xs">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold text-slate-900">
                  {p.status.replace(/_/g, " ")}
                </dd>
              </div>
              {p.expectedEndDate && (
                <div className="flex items-center justify-between text-xs">
                  <dt className="text-slate-500">Expected End</dt>
                  <dd className="flex items-center gap-1 font-medium text-slate-700">
                    <CalendarDays className="h-3 w-3 text-emerald-500" />
                    {new Date(p.expectedEndDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {p.supervisor.supervisorProfile?.specialization && (
                <div className="flex items-center justify-between text-xs">
                  <dt className="text-slate-500">Specialization</dt>
                  <dd className="flex items-center gap-1 font-medium text-slate-700">
                    <Briefcase className="h-3 w-3 text-emerald-500" />
                    {p.supervisor.supervisorProfile.specialization}
                  </dd>
                </div>
              )}
            </dl>
          </SectionCard>

          {/* Milestones timeline */}
          <SectionCard
            title="Milestones"
            description="Your project roadmap & due dates"
            icon={Clock}
            delay={0.25}
            className="lg:col-span-2"
            flushBody
            action={
              <Link
                href="/student/project"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all
              </Link>
            }
          >
            <ul className="divide-y divide-slate-100">
              {p.milestones.map((m) => {
                const style = milestoneStatusStyle[m.status]
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60"
                  >
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {m.name}
                      </p>
                      {m.dueDate && (
                        <p className="text-xs text-slate-500">
                          Due {new Date(m.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium ${style.text} ring-1 ring-inset ring-slate-100`}
                    >
                      {style.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        </div>
      </section>

      {/* ── Insights ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Breakdown of your milestones & documents">
          Insights
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Milestone breakdown */}
          {d.milestoneBreakdown.length > 0 && (
            <SectionCard
              title="Milestone Status"
              description="By status category"
              icon={TrendingUp}
              delay={0.3}
              bodyClassName="pt-2"
            >
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={d.milestoneBreakdown}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
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
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) =>
                      v
                        .replace(/_/g, " ")
                        .toLowerCase()
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                    }
                    width={80}
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
          )}

          {/* Document type distribution */}
          {d.documentTypeDistribution.length > 0 && (
            <SectionCard
              title="Document Types"
              description="What you've uploaded"
              icon={FileText}
              delay={0.35}
              bodyClassName="pt-2"
            >
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={d.documentTypeDistribution}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={2}
                    >
                      {d.documentTypeDistribution.map((entry) => (
                        <Cell
                          key={entry.type}
                          fill={docTypeColors[entry.type] ?? "#cbd5e1"}
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
                        `${value} doc${value !== 1 ? "s" : ""}`,
                        docTypeLabels[
                          (props.payload as { type: string }).type
                        ] ??
                          (props.payload as { type: string }).type.replace(
                            /_/g,
                            " ",
                          ),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid w-full grid-cols-1 gap-1.5">
                  {d.documentTypeDistribution.map((d2) => (
                    <div
                      key={d2.type}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            docTypeColors[d2.type] ?? "#cbd5e1",
                        }}
                      />
                      <span className="text-slate-500">
                        {docTypeLabels[d2.type] ?? d2.type.replace(/_/g, " ")}
                      </span>
                      <span className="ml-auto font-semibold tabular-nums text-slate-900">
                        {d2.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Recent activity */}
          <SectionCard
            title="Recent Activity"
            description="Your latest notifications"
            icon={Activity}
            delay={0.4}
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
                      className={`flex gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50/60 ${
                        !a.isRead ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-100">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900">
                          {a.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
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

      {/* ── Topic & Feedback ─────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel hint="Approvals & supervisor comments">
          Topic &amp; Feedback
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Topic status */}
          {p.topics[0] && (
            <SectionCard
              title="Topic Status"
              description="Your approved project topic"
              icon={FileCheck}
              delay={0.45}
            >
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {p.topics[0].title}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${topicStatusBadge[p.topics[0].status]}`}
                  >
                    {p.topics[0].status.replace(/_/g, " ")}
                  </span>
                </div>
                {p.topics[0].reviewerComment && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Reviewer Comment
                    </p>
                    <p className="mt-1 text-xs italic text-slate-600">
                      &ldquo;{p.topics[0].reviewerComment}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Recent feedback */}
          <SectionCard
            title="Recent Feedback"
            description="Comments from your supervisor"
            icon={MessageCircle}
            delay={0.5}
            flushBody
            action={
              <Link
                href="/student/feedback"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all
              </Link>
            }
          >
            {p.feedback.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No feedback yet
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {p.feedback.slice(0, 5).map((f) => (
                  <li
                    key={f.id}
                    className="px-5 py-3 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {f.author.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          f.status === "PENDING"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {f.content}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(f.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {quickActions.map((qa) => {
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {qa.label}
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {qa.description}
                </p>
              </Link>
            )
          })}
        </motion.div>
      </section>
    </div>
  )
}

// Avoid unused import warnings
void Bell
void AlertCircle
