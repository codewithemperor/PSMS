"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import {
  GraduationCap,
  Search,
  Loader2,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"
import type { ProjectStatus } from "@/types"

interface StudentRow {
  studentId: string
  studentName: string
  studentEmail: string
  studentMatricNo: string
  studentDepartment: string
  studentAvatar: string | null
  level: string | null
  programme: string | null
  allocation: {
    academicYear: string
    semester: string
    allocatedAt: string
  } | null
  projectId: string | null
  projectTitle: string | null
  projectStatus: ProjectStatus | null
  projectProgress: number
  projectUpdatedAt: string | null
  totalMilestones: number
  completedMilestones: number
  currentMilestone: {
    id: string
    name: string
    status: string
    dueDate: string | null
  } | null
  lastActivity: string | null
  lastFeedbackAt: string | null
  lastFeedbackStatus: string | null
  lastDocumentAt: string | null
}

interface StudentsResponse {
  success: boolean
  data: StudentRow[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

const statusBadge: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
}

function formatStatus(s: string | null): string {
  if (!s) return "No Project"
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function progressColorClass(p: number): string {
  if (p < 30) return "[&>div]:bg-rose-500"
  if (p < 60) return "[&>div]:bg-amber-500"
  return "[&>div]:bg-emerald-500"
}

export function MyStudents() {
  const userId = useAuthStore((s) => s.user?.id)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("progress_desc")

  // Debounce search input → search term (300ms)
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  const { data, isLoading } = useQuery<StudentsResponse>({
    queryKey: ["supervisor-students", userId, search, status, sortBy],
    enabled: !!userId,
    queryFn: async () => {
      const params = new URLSearchParams({
        XTransformPort: "3000",
      })
      if (search) params.set("search", search)
      if (status && status !== "all") params.set("status", status)
      if (sortBy) params.set("sortBy", sortBy)
      params.set("limit", "50")
      const res = await fetch(
        `/api/supervisors/${userId}/students?${params.toString()}`,
      )
      const json = await res.json()
      return json as StudentsResponse
    },
  })

  const students = data?.data ?? []

  // Summary stats computed from the visible list
  const total = students.length
  const activeProjects = students.filter(
    (s) => s.projectStatus === "IN_PROGRESS",
  ).length
  const avgProgress =
    total > 0
      ? Math.round(
          students.reduce((s, st) => s + (st.projectProgress ?? 0), 0) / total,
        )
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">My Students</h1>
        <p className="mt-1 text-sm text-slate-500">
          Students assigned to you for project supervision
        </p>
      </motion.div>

      {/* Summary Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-x-6 gap-y-1 text-sm"
      >
        <span className="text-slate-500">
          <strong className="text-slate-800">{total}</strong> students assigned
        </span>
        <span className="text-slate-500">
          <strong className="text-slate-800">{activeProjects}</strong> active
          projects
        </span>
        <span className="text-slate-500">
          <strong className="text-slate-800">{avgProgress}%</strong> avg
          progress
        </span>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or matric no..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-lg pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full rounded-lg sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full rounded-lg sm:w-52">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="progress_desc">
              Progress (High to Low)
            </SelectItem>
            <SelectItem value="progress_asc">
              Progress (Low to High)
            </SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="lastActivity">Last Activity</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Student Cards Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description="No students match your current filters, or no students have been allocated to you yet."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.map((s, idx) => (
            <motion.div
              key={s.studentId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.4) }}
            >
              <Card className="rounded-xl border-slate-200/60 transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  {/* Header: avatar + name + status */}
                  <div className="flex items-start gap-3">
                    <UserAvatar name={s.studentName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        {s.studentName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {s.studentMatricNo || s.studentEmail}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0",
                        s.projectStatus
                          ? statusBadge[s.projectStatus]
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {formatStatus(s.projectStatus)}
                    </Badge>
                  </div>

                  {/* Project title + progress */}
                  <div className="mt-4">
                    <p className="truncate text-sm font-medium text-slate-600">
                      {s.projectTitle || "No project yet"}
                    </p>
                    {s.projectTitle && (
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>Progress</span>
                          <span>{s.projectProgress}%</span>
                        </div>
                        <Progress
                          value={s.projectProgress}
                          className={cn(
                            "h-2",
                            progressColorClass(s.projectProgress),
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Footer: last active + actions */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="truncate text-xs text-slate-400">
                      Last active{" "}
                      {s.lastActivity
                        ? formatDistanceToNow(new Date(s.lastActivity), {
                            addSuffix: true,
                          })
                        : "—"}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                        asChild
                      >
                        <Link href={`/supervisor/students/${s.studentId}`}>
                          View Project
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-xs"
                        asChild
                      >
                        <Link href="/supervisor/messages">
                          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Message
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
