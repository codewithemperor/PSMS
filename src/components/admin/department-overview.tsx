"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts"
import {
  GraduationCap,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  ArrowUpDown,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"
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
import { StatsCard } from "@/components/shared/stats-card"
import { EmptyState } from "@/components/shared/empty-state"
import type { ProjectStatus } from "@/types"

interface OverviewData {
  summary: {
    enrolledStudents: number
    activeSupervisors: number
    totalProjects: number
    averageProgress: number
    atRiskProjects: number
  }
  projectRows: {
    id: string
    title: string
    status: ProjectStatus
    progress: number
    startDate: string | null
    expectedEndDate: string | null
    studentId: string
    studentName: string
    studentMatricNo: string | null
    supervisorId: string
    supervisorName: string
  }[]
  supervisorPerformance: {
    supervisorId: string
    name: string
    specialization: string | null
    studentCount: number
    avgProgress: number
  }[]
  milestoneCompletion: {
    name: string
    total: number
    completed: number
    completionRate: number
  }[]
}

const progressColor = (p: number) =>
  p < 30 ? "rose" : p < 60 ? "amber" : "emerald"

const statusBadgeClass: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
}

export function DepartmentOverview() {
  const [sortBy, setSortBy] = useState<"progress" | "title" | "student">(
    "progress",
  )

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["overview"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/overview")
      const json = await res.json()
      return json.data
    },
  })

  const projectRows = data?.projectRows ?? []
  const sortedProjects = useMemo(() => {
    const rows = [...projectRows]
    if (sortBy === "progress") rows.sort((a, b) => a.progress - b.progress)
    else if (sortBy === "title") rows.sort((a, b) => a.title.localeCompare(b.title))
    else if (sortBy === "student")
      rows.sort((a, b) => a.studentName.localeCompare(b.studentName))
    return rows
  }, [projectRows, sortBy])

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Department Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Loading department analytics...
          </p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      </div>
    )
  }

  const { summary: s } = data

  // Short supervisor names for chart x-axis
  const supData = data.supervisorPerformance.map((sup) => ({
    name: sup.name.replace(/^(Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s/, "").split(" ")[0],
    fullName: sup.name,
    students: sup.studentCount,
    avgProgress: sup.avgProgress,
  }))

  // Milestone completion data for horizontal bar
  const milestoneData = [...data.milestoneCompletion].sort(
    (a, b) => a.completionRate - b.completionRate,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">
          Department Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Department-wide analytics on projects, supervisors, and milestones.
        </p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Enrolled Students"
          value={s.enrolledStudents}
          icon={GraduationCap}
          tone="emerald"
          delay={0}
        />
        <StatsCard
          title="Active Supervisors"
          value={s.activeSupervisors}
          icon={UserCheck}
          tone="teal"
          delay={0.05}
        />
        <StatsCard
          title="Avg. Progress"
          value={`${s.averageProgress}%`}
          icon={TrendingUp}
          tone="amber"
          delay={0.1}
        />
        <StatsCard
          title="Projects at Risk"
          value={s.atRiskProjects}
          icon={AlertTriangle}
          tone="rose"
          description="< 30% progress"
          delay={0.15}
        />
      </div>

      {/* Project progress table */}
      <Card className="rounded-xl border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-700">
            Project Progress
          </CardTitle>
          <CardDescription className="text-xs">
            Click a column header to sort. Projects at the top need the most
            attention.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {sortedProjects.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No projects yet"
              description="Projects will appear here once topics are approved."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                  <TableHead>
                    <button
                      onClick={() => setSortBy("student")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                    >
                      Student
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Supervisor
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => setSortBy("title")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                    >
                      Project Title
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[200px]">
                    <button
                      onClick={() => setSortBy("progress")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                    >
                      Progress
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Deadline
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.map((p) => (
                  <TableRow
                    key={p.id}
                    className="border-slate-100 hover:bg-slate-50/50"
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {p.studentName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.studentMatricNo ?? "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {p.supervisorName}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm text-slate-700">
                        {p.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={p.progress}
                          className={`h-2 w-24 ${progressColor(p.progress) === "rose" ? "[&>div]:bg-rose-500" : progressColor(p.progress) === "amber" ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                        />
                        <span
                          className={`text-xs font-semibold ${
                            progressColor(p.progress) === "rose"
                              ? "text-rose-600"
                              : progressColor(p.progress) === "amber"
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {p.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusBadgeClass[p.status]}
                        variant="outline"
                      >
                        {p.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {p.expectedEndDate
                        ? format(new Date(p.expectedEndDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Supervisor performance — Bar + Line combo */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-700">
                Supervisor Performance
              </CardTitle>
              <CardDescription className="text-xs">
                Average project progress (bars) vs. student load (line)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={supData}
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
                        (payload?.[0]?.payload as { fullName?: string })
                          ?.fullName ?? ""
                      }
                      contentStyle={{
                        borderRadius: "0.5rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="avgProgress"
                      name="Avg Progress %"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                    >
                      <LabelList
                        dataKey="avgProgress"
                        position="top"
                        formatter={(v: number) => `${v}%`}
                        style={{
                          fontSize: 11,
                          fill: "#334155",
                          fontWeight: 600,
                        }}
                      />
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="students"
                      name="Students"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#f59e0b" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Milestone completion — horizontal bars */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="h-full rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-700">
                Milestone Completion
              </CardTitle>
              <CardDescription className="text-xs">
                Completion rate across all projects by milestone
              </CardDescription>
            </CardHeader>
            <CardContent>
              {milestoneData.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No milestone data"
                  description="Milestones will appear once projects have them."
                />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={milestoneData}
                      layout="vertical"
                      margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f1f5f9"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value: number, _name, item) => {
                          const payload = item.payload as {
                            completed: number
                            total: number
                          }
                          return [
                            `${value}% (${payload.completed}/${payload.total})`,
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
                        {milestoneData.map((m, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              m.completionRate >= 80
                                ? "#10b981"
                                : m.completionRate >= 50
                                  ? "#f59e0b"
                                  : "#f43f5e"
                            }
                          />
                        ))}
                        <LabelList
                          dataKey="completionRate"
                          position="right"
                          formatter={(v: number) => `${v}%`}
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
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
