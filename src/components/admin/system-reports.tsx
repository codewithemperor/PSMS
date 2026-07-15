"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  FolderKanban,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  Download,
  Loader2,
  Users,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { StatsCard } from "@/components/shared/stats-card"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import type { ProjectStatus } from "@/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepartmentReport {
  summary: {
    totalStudents: number
    totalSupervisors: number
    totalProjects: number
    avgProgress: number
    completionRate: number
  }
  progressDistribution: {
    range: string
    min: number
    max: number
    count: number
  }[]
  supervisorPerformance: {
    supervisorId: string
    name: string
    specialization: string | null
    totalStudents: number
    avgProgress: number
    completedProjects: number
    activeProjects: number
  }[]
  milestoneCompletion: {
    milestoneName: string
    totalAssigned: number
    completed: number
    completionRate: number
  }[]
  topicApprovalRate: {
    submitted: number
    approved: number
    rejected: number
    revisionRequested: number
    pending: number
    approvalRate: number
  }
}

interface SupervisorReport {
  supervisor: {
    name: string
    specialization: string | null
    department: string | null
  }
  workload: {
    current: number
    max: number
    utilization: number
  }
  students: {
    studentId: string
    studentName: string
    studentMatricNo: string | null
    projectId: string | null
    projectTitle: string | null
    progress: number
    status: ProjectStatus
    lastActivity: string | null
  }[]
  feedbackStats: {
    totalGiven: number
    addressed: number
    pending: number
    addressedRate: number
  }
  milestoneStats: {
    total: number
    completed: number
    overdue: number
    avgCompletionRate: number
  }
}

interface StudentRow {
  studentId: string
  studentName: string
  studentMatricNo: string | null
  supervisorId: string | null
  supervisorName: string | null
  projectId: string | null
  projectTitle: string | null
  progress: number
  status: ProjectStatus
  milestonesTotal: number
  milestonesCompleted: number
  milestonesOverdue: number
  lastActivity: string | null
}

interface SupervisorOption {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusBadgeClass: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
}

function formatStatus(s: ProjectStatus): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return "—"
  }
}

const progressColor = (p: number) =>
  p < 30 ? "rose" : p < 60 ? "amber" : "emerald"

const progressBg = (p: number) =>
  p < 30
    ? "[&>div]:bg-rose-500"
    : p < 60
      ? "[&>div]:bg-amber-500"
      : "[&>div]:bg-emerald-500"

// Topic pie chart data
const topicPieColors = {
  approved: "#10b981",
  pending: "#f59e0b",
  rejected: "#f43f5e",
  revision: "#0d9488",
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChartCard({
  title,
  description,
  children,
  delay = 0,
}: {
  title: string
  description?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="h-full rounded-xl border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-700">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs">{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full overflow-x-auto">{children}</div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="rounded-xl border-slate-200/60">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-10 w-10 text-rose-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">
          Failed to load report
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

function ChartSkeleton() {
  return (
    <Card className="h-full rounded-xl border-slate-200/60">
      <CardHeader className="pb-3">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-56 animate-pulse rounded bg-slate-50" />
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full animate-pulse rounded-lg bg-slate-50" />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Department tab
// ---------------------------------------------------------------------------

function DepartmentReportTab() {
  const { data, isLoading, isError, refetch } = useQuery<DepartmentReport>({
    queryKey: ["report-department"],
    queryFn: async () => {
      const res = await fetch("/api/reports/department")
      if (!res.ok) throw new Error("Failed to fetch department report")
      const json = await res.json()
      return json.data
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-200/60 bg-white"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => refetch()} />
  }

  const { summary, progressDistribution, supervisorPerformance, milestoneCompletion, topicApprovalRate } =
    data

  // Short supervisor names for chart x-axis
  const supData = supervisorPerformance.map((s) => ({
    name: s.name.replace(/^(Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s/, "").split(" ")[0],
    fullName: s.name,
    avgProgress: s.avgProgress,
    totalStudents: s.totalStudents,
  }))

  const milestoneData = [...milestoneCompletion].sort(
    (a, b) => a.completionRate - b.completionRate,
  )

  const topicPieData = [
    { name: "Approved", value: topicApprovalRate.approved, color: topicPieColors.approved },
    { name: "Pending", value: topicApprovalRate.pending, color: topicPieColors.pending },
    { name: "Rejected", value: topicApprovalRate.rejected, color: topicPieColors.rejected },
    { name: "Revision", value: topicApprovalRate.revisionRequested, color: topicPieColors.revision },
  ].filter((d) => d.value > 0)

  // Overdue milestones count: any milestone in the report where completionRate
  // is below 100% across all projects is a rough proxy. For simplicity we
  // count milestones whose completionRate < 100% (incomplete buckets).
  const incompleteMilestoneBuckets = milestoneCompletion.filter(
    (m) => m.completionRate < 100,
  ).length

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Projects"
          value={summary.totalProjects}
          icon={FolderKanban}
          tone="emerald"
          description={`Completion rate: ${summary.completionRate}%`}
          delay={0}
        />
        <StatsCard
          title="Avg. Progress"
          value={`${summary.avgProgress}%`}
          icon={TrendingUp}
          tone="teal"
          description="Across all projects"
          delay={0.05}
        />
        <StatsCard
          title="Topic Approval Rate"
          value={`${topicApprovalRate.approvalRate}%`}
          icon={FileCheck}
          tone="amber"
          description={`${topicApprovalRate.approved}/${topicApprovalRate.submitted} approved`}
          delay={0.1}
        />
        <StatsCard
          title="Overdue Milestones"
          value={incompleteMilestoneBuckets}
          icon={AlertTriangle}
          tone="rose"
          description="Milestone types behind schedule"
          delay={0.15}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Student Progress Distribution"
          description="Project count per progress range"
          delay={0.2}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={progressDistribution}
              margin={{ top: 16, right: 16, left: -8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: "#64748b" }}
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
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                }}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar
                dataKey="count"
                name="Projects"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Supervisor Performance"
          description="Avg progress (bars) vs. student load (line)"
          delay={0.25}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={supData}
              margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                labelFormatter={(_, payload) =>
                  (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""
                }
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem" }}
                iconType="circle"
              />
              <Bar
                yAxisId="left"
                dataKey="avgProgress"
                name="Avg Progress %"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalStudents"
                name="Students"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4, fill: "#f59e0b" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Milestone Completion Rates"
          description="Completion % per milestone type"
          delay={0.3}
        >
          {milestoneData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No milestone data"
              description="Milestones will appear once projects have them."
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={milestoneData}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="milestoneName"
                  width={140}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, _name, item) => {
                    const payload = item.payload as {
                      completed: number
                      totalAssigned: number
                    }
                    return [
                      `${value}% (${payload.completed}/${payload.totalAssigned})`,
                      "Completion",
                    ]
                  }}
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                  }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar
                  dataKey="completionRate"
                  name="Completion Rate"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={28}
                >
                  {milestoneData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.completionRate > 80
                          ? "#10b981"
                          : entry.completionRate > 50
                            ? "#f59e0b"
                            : "#f43f5e"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Topic Approval Summary"
          description="Distribution of topic submissions by status"
          delay={0.35}
        >
          {topicPieData.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="No topics submitted"
              description="Topic submissions will appear here."
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topicPieData}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {topicPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "0.75rem" }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Supervisor tab
// ---------------------------------------------------------------------------

function SupervisorReportTab() {
  const [selectedId, setSelectedId] = useState<string>("")

  // Fetch the supervisor list (admin-only endpoint returns all users w/ role)
  const { data: supervisors } = useQuery<SupervisorOption[]>({
    queryKey: ["supervisor-options"],
    queryFn: async () => {
      const res = await fetch(
        "/api/users?role=SUPERVISOR&limit=100",
      )
      if (!res.ok) throw new Error("Failed to fetch supervisors")
      const json = await res.json()
      const list: SupervisorOption[] = (json.data ?? []).map(
        (u: { id: string; name: string }) => ({ id: u.id, name: u.name }),
      )
      return list
    },
  })

  const {
    data: report,
    isLoading,
    isError,
    refetch,
  } = useQuery<SupervisorReport>({
    queryKey: ["report-supervisor", selectedId],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/supervisor/${selectedId}`,
      )
      if (!res.ok) throw new Error("Failed to fetch supervisor report")
      const json = await res.json()
      return json.data
    },
    enabled: !!selectedId,
  })

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-slate-200/60">
        <CardContent className="p-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Select Supervisor
          </Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="mt-1.5 w-full max-w-md rounded-lg">
              <SelectValue placeholder="Choose a supervisor..." />
            </SelectTrigger>
            <SelectContent>
              {(supervisors ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {supervisors && supervisors.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">
              No active supervisors found.
            </p>
          )}
        </CardContent>
      </Card>

      {!selectedId ? (
        <EmptyState
          icon={Users}
          title="Select a supervisor"
          description="Choose a supervisor above to view their workload, student list, and feedback stats."
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-xl border border-slate-200/60 bg-white" />
          <div className="h-48 animate-pulse rounded-xl border border-slate-200/60 bg-white" />
          <div className="h-64 animate-pulse rounded-xl border border-slate-200/60 bg-white md:col-span-2" />
        </div>
      ) : isError || !report ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          {/* Profile + workload */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full rounded-xl border-slate-200/60">
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <UserAvatar name={report.supervisor.name} size="lg" />
                  <h3 className="mt-3 text-lg font-bold text-slate-800">
                    {report.supervisor.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {report.supervisor.specialization || "—"}
                  </p>
                  {report.supervisor.department && (
                    <p className="mt-1 text-xs text-slate-400">
                      {report.supervisor.department}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className="h-full rounded-xl border-slate-200/60">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-700">
                    Workload
                  </p>
                  <div className="mb-2 mt-4 flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Students assigned
                    </span>
                    <span className="text-lg font-bold text-slate-800">
                      {report.workload.current}/{report.workload.max}
                    </span>
                  </div>
                  <Progress
                    value={report.workload.utilization}
                    className={`h-3 ${
                      report.workload.utilization >= 100
                        ? "[&>div]:bg-rose-500"
                        : report.workload.utilization >= 80
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-emerald-500"
                    }`}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {report.workload.utilization}% capacity used
                  </p>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-800">
                        {report.feedbackStats.totalGiven}
                      </p>
                      <p className="text-xs text-slate-500">Feedback Given</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-emerald-600">
                        {report.feedbackStats.addressed}
                      </p>
                      <p className="text-xs text-slate-500">Addressed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-amber-600">
                        {report.feedbackStats.pending}
                      </p>
                      <p className="text-xs text-slate-500">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Student performance table */}
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-700">
                Student Performance
              </CardTitle>
              <CardDescription className="text-xs">
                {report.students.length} student
                {report.students.length === 1 ? "" : "s"} under this supervisor
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {report.students.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No students allocated"
                  description="This supervisor has no active student allocations."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Student
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Project
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Progress
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Last Activity
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.students.map((s) => (
                      <TableRow
                        key={s.studentId}
                        className="border-slate-100 hover:bg-slate-50/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={s.studentName} size="sm" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                {s.studentName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {s.studentMatricNo ?? "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-slate-600">
                          <p className="truncate">
                            {s.projectTitle || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={s.progress}
                              className={`h-2 w-20 ${progressBg(s.progress)}`}
                            />
                            <span
                              className={`text-xs font-semibold ${
                                progressColor(s.progress) === "rose"
                                  ? "text-rose-600"
                                  : progressColor(s.progress) === "amber"
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                              }`}
                            >
                              {s.progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass[s.status]}
                          >
                            {formatStatus(s.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {formatRelativeTime(s.lastActivity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Student progress tab
// ---------------------------------------------------------------------------

function StudentProgressTab() {
  const [filterSupervisor, setFilterSupervisor] = useState<string>("all")
  const [filterRange, setFilterRange] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Flat student list from the dedicated endpoint
  const { data: students, isLoading, isError, refetch } = useQuery<StudentRow[]>({
    queryKey: ["report-students"],
    queryFn: async () => {
      const res = await fetch("/api/reports/students")
      if (!res.ok) throw new Error("Failed to fetch student report")
      const json = await res.json()
      return json.data
    },
  })

  // Supervisor options pulled from the same endpoint (deduped)
  const supervisorOptions = useMemo(() => {
    if (!students) return []
    const map = new Map<string, string>()
    for (const s of students) {
      if (s.supervisorId && s.supervisorName) {
        map.set(s.supervisorId, s.supervisorName)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [students])

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter((s) => {
      if (filterSupervisor !== "all" && s.supervisorId !== filterSupervisor)
        return false
      if (filterRange !== "all") {
        const p = s.progress
        if (filterRange === "0-25" && (p < 0 || p > 25)) return false
        if (filterRange === "26-50" && (p < 26 || p > 50)) return false
        if (filterRange === "51-75" && (p < 51 || p > 75)) return false
        if (filterRange === "76-100" && (p < 76 || p > 100)) return false
      }
      if (filterStatus !== "all" && s.status !== filterStatus) return false
      return true
    })
  }, [students, filterSupervisor, filterRange, filterStatus])

  function exportCSV() {
    if (!filteredStudents || filteredStudents.length === 0) {
      toast.error("Nothing to export — no students match the current filters")
      return
    }
    const headers = [
      "Student Name",
      "Matric No",
      "Supervisor",
      "Project Title",
      "Progress %",
      "Milestones Completed",
      "Milestones Total",
      "Status",
      "Last Activity",
    ]
    const rows = filteredStudents.map((s) => [
      s.studentName,
      s.studentMatricNo ?? "",
      s.supervisorName ?? "",
      s.projectTitle ?? "",
      s.progress,
      s.milestonesCompleted,
      s.milestonesTotal,
      s.status,
      formatRelativeTime(s.lastActivity),
    ])
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `student-progress-report-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Report exported successfully")
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="rounded-xl border-slate-200/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Supervisor
            </Label>
            <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
              <SelectTrigger className="w-full rounded-lg sm:w-48">
                <SelectValue placeholder="All supervisors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All supervisors</SelectItem>
                {supervisorOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Progress Range
            </Label>
            <Select value={filterRange} onValueChange={setFilterRange}>
              <SelectTrigger className="w-full rounded-lg sm:w-40">
                <SelectValue placeholder="All ranges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ranges</SelectItem>
                <SelectItem value="0-25">0 – 25%</SelectItem>
                <SelectItem value="26-50">26 – 50%</SelectItem>
                <SelectItem value="51-75">51 – 75%</SelectItem>
                <SelectItem value="76-100">76 – 100%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Status
            </Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full rounded-lg sm:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-end">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={exportCSV}
              disabled={!filteredStudents || filteredStudents.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student progress table */}
      <Card className="overflow-hidden rounded-xl border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-700">
            Student Progress
          </CardTitle>
          <CardDescription className="text-xs">
            {filteredStudents.length} student
            {filteredStudents.length === 1 ? "" : "s"} matching filters
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students found"
              description="No students match the selected filters. Try clearing them."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Student
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Supervisor
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Progress
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Milestones
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last Activity
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s) => (
                  <TableRow
                    key={s.studentId}
                    className="border-slate-100 hover:bg-slate-50/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={s.studentName} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {s.studentName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {s.studentMatricNo ?? "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {s.supervisorName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm text-slate-700">
                        {s.projectTitle ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={s.progress}
                          className={`h-2 w-20 ${progressBg(s.progress)}`}
                        />
                        <span
                          className={`text-xs font-semibold ${
                            progressColor(s.progress) === "rose"
                              ? "text-rose-600"
                              : progressColor(s.progress) === "amber"
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {s.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-slate-700">
                          {s.milestonesCompleted}/{s.milestonesTotal}
                        </span>
                        {s.milestonesOverdue > 0 && (
                          <Badge
                            variant="outline"
                            className="bg-rose-100 text-rose-600"
                          >
                            {s.milestonesOverdue} overdue
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass[s.status]}
                      >
                        {formatStatus(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {formatRelativeTime(s.lastActivity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SystemReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Reports &amp; Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate and view department performance reports, supervisor workload,
          and student progress.
        </p>
      </div>

      <Tabs defaultValue="department">
        <TabsList className="rounded-lg bg-slate-100">
          <TabsTrigger value="department">Department Report</TabsTrigger>
          <TabsTrigger value="supervisor">Supervisor Report</TabsTrigger>
          <TabsTrigger value="students">Student Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="department" className="mt-6">
          <DepartmentReportTab />
        </TabsContent>

        <TabsContent value="supervisor" className="mt-6">
          <SupervisorReportTab />
        </TabsContent>

        <TabsContent value="students" className="mt-6">
          <StudentProgressTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
