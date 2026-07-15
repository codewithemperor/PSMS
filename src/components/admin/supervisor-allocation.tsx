"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Search,
  Loader2,
  UserCheck,
  Users as UsersIcon,
  AlertCircle,
  Ban,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  GraduationCap,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

// Allocations are recorded under a fixed "Current" academic year. The session
// concept has been removed from the UI entirely.
const ACADEMIC_YEAR = "Current"

interface AllocationRow {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  studentMatricNo: string | null
  studentDepartment: string | null
  studentLevel: string | null
  supervisorId: string
  supervisorName: string
  supervisorEmail: string
  supervisorSpecialization: string | null
  academicYear: string
  semester: string
  status: "ACTIVE" | "REVOKED"
  allocatedAt: string
}

interface UserOption {
  id: string
  name: string
  email: string
  matricNo?: string | null
  staffId?: string | null
  department?: string | null
  role: string
  supervisorProfile?: {
    specialization: string | null
    maxStudents: number
    currentLoad: number
  } | null
  studentProfile?: {
    level: string | null
    programme: string | null
  } | null
}

export function SupervisorAllocation() {
  const queryClient = useQueryClient()

  // --- Table filters ---
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "REVOKED">(
    "ACTIVE",
  )
  const [supervisorFilter, setSupervisorFilter] = useState<string>("ALL")

  // --- Modal state ---
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(),
  )
  const [studentSearch, setStudentSearch] = useState("")
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(
    null,
  )
  const [revokeTarget, setRevokeTarget] = useState<AllocationRow | null>(null)

  // --- Fetch allocations ---
  const {
    data: allocations,
    isLoading: allocationsLoading,
  } = useQuery<AllocationRow[]>({
    queryKey: ["allocations"],
    queryFn: async () => {
      const res = await fetch("/api/allocations")
      const json = await res.json()
      return (json.data ?? []) as AllocationRow[]
    },
  })

  // --- Fetch all students (for the picker) ---
  const { data: allStudents, isLoading: studentsLoading } = useQuery<
    UserOption[]
  >({
    queryKey: ["all-students"],
    queryFn: async () => {
      const res = await fetch(
        "/api/users?role=STUDENT&limit=200",
      )
      const json = await res.json()
      return (json.data ?? []) as UserOption[]
    },
  })

  // --- Fetch all supervisors (for the picker) ---
  const { data: allSupervisors, isLoading: supervisorsLoading } = useQuery<
    UserOption[]
  >({
    queryKey: ["all-supervisors"],
    queryFn: async () => {
      const res = await fetch(
        "/api/users?role=SUPERVISOR&limit=100",
      )
      const json = await res.json()
      return (json.data ?? []) as UserOption[]
    },
  })

  // --- Derived: which students already have an ACTIVE allocation? ---
  const allocatedStudentIds = useMemo(() => {
    return new Set(
      (allocations ?? [])
        .filter((a) => a.status === "ACTIVE")
        .map((a) => a.studentId),
    )
  }, [allocations])

  // --- Derived: unallocated students for the picker ---
  const unallocatedStudents = useMemo(() => {
    return (allStudents ?? []).filter((s) => !allocatedStudentIds.has(s.id))
  }, [allStudents, allocatedStudentIds])

  // --- Derived: available supervisors (currentLoad < maxStudents) ---
  const availableSupervisors = useMemo(() => {
    return (allSupervisors ?? []).filter((s) => {
      const load = s.supervisorProfile?.currentLoad ?? 0
      const max = s.supervisorProfile?.maxStudents ?? 5
      return load < max
    })
  }, [allSupervisors])

  // --- Filtered students in the picker ---
  const filteredStudents = useMemo(() => {
    const list = unallocatedStudents
    if (!studentSearch.trim()) return list
    const q = studentSearch.toLowerCase()
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.matricNo ?? "").toLowerCase().includes(q),
    )
  }, [unallocatedStudents, studentSearch])

  // --- Filtered allocations for the table ---
  const filteredAllocations = useMemo(() => {
    const list = allocations ?? []
    return list.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false
      if (supervisorFilter !== "ALL" && a.supervisorId !== supervisorFilter)
        return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches =
          a.studentName.toLowerCase().includes(q) ||
          (a.studentMatricNo ?? "").toLowerCase().includes(q) ||
          a.supervisorName.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [allocations, statusFilter, supervisorFilter, search])

  // --- Unique supervisors for the filter dropdown ---
  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of allocations ?? []) {
      if (!map.has(a.supervisorId)) map.set(a.supervisorId, a.supervisorName)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [allocations])

  // --- Stats ---
  const activeCount = (allocations ?? []).filter(
    (a) => a.status === "ACTIVE",
  ).length
  const revokedCount = (allocations ?? []).filter(
    (a) => a.status === "REVOKED",
  ).length

  // --- Batch allocate mutation ---
  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSupervisorId) throw new Error("No supervisor selected")
      const allocationsPayload = Array.from(selectedStudentIds).map(
        (studentId) => ({
          studentId,
          supervisorId: selectedSupervisorId,
        }),
      )
      const res = await fetch("/api/allocations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: allocationsPayload,
          academicYear: ACADEMIC_YEAR,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = Array.isArray(json.details)
          ? json.details.join("; ")
          : json.error ?? "Failed to allocate students"
        throw new Error(detail)
      }
      return json
    },
    onSuccess: (data) => {
      const supName =
        allSupervisors?.find((s) => s.id === selectedSupervisorId)?.name ??
        "supervisor"
      toast.success(
        `Allocated ${data.count} student${
          data.count === 1 ? "" : "s"
        } to ${supName}`,
      )
      queryClient.invalidateQueries({ queryKey: ["allocations"] })
      queryClient.invalidateQueries({ queryKey: ["all-students"] })
      queryClient.invalidateQueries({ queryKey: ["all-supervisors"] })
      closeModal()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // --- Revoke mutation ---
  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/allocations/${id}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to revoke allocation")
      return json
    },
    onSuccess: () => {
      toast.success("Allocation revoked")
      queryClient.invalidateQueries({ queryKey: ["allocations"] })
      queryClient.invalidateQueries({ queryKey: ["all-students"] })
      queryClient.invalidateQueries({ queryKey: ["all-supervisors"] })
      setRevokeTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function closeModal() {
    setModalOpen(false)
    setStep(1)
    setSelectedStudentIds(new Set())
    setStudentSearch("")
    setSelectedSupervisorId(null)
  }

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedSupervisor = allSupervisors?.find(
    (s) => s.id === selectedSupervisorId,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Supervisor Allocation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Allocate students to supervisors and manage existing allocations.
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          Allocate Students
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      >
        <Card className="rounded-xl border-slate-200/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{activeCount}</p>
              <p className="text-xs text-slate-500">Active Allocations</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
              <Ban className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{revokedCount}</p>
              <p className="text-xs text-slate-500">Revoked</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50">
              <GraduationCap className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {unallocatedStudents.length}
              </p>
              <p className="text-xs text-slate-500">Unallocated Students</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters + Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-xl border-slate-200/60">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base text-slate-800">
                  Current Allocations
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  {filteredAllocations.length} of {allocations?.length ?? 0}{" "}
                  allocation{filteredAllocations.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search student or supervisor…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg pl-9 sm:w-64"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as "ALL" | "ACTIVE" | "REVOKED")
                  }
                >
                  <SelectTrigger className="w-full rounded-lg sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="REVOKED">Revoked</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={supervisorFilter}
                  onValueChange={setSupervisorFilter}
                >
                  <SelectTrigger className="w-full rounded-lg sm:w-44">
                    <SelectValue placeholder="All Supervisors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Supervisors</SelectItem>
                    {supervisorOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {allocationsLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredAllocations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={UserCheck}
                  title="No allocations found"
                  description={
                    allocations && allocations.length > 0
                      ? "Try adjusting your filters."
                      : "Click 'Allocate Students' to assign students to supervisors."
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Student
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Supervisor
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Allocated
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllocations.map((a) => (
                      <TableRow
                        key={a.id}
                        className="border-slate-100 hover:bg-slate-50/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={a.studentName} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {a.studentName}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {a.studentMatricNo ?? a.studentEmail}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={a.supervisorName} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {a.supervisorName}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {a.supervisorSpecialization ?? "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              a.status === "ACTIVE"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                            }
                          >
                            {a.status === "ACTIVE" ? "Active" : "Revoked"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {format(new Date(a.allocatedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.status === "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRevokeTarget(a)}
                              className="rounded-lg text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Ban className="mr-1 h-3.5 w-3.5" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Allocate Students Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 rounded-2xl p-0">
          <DialogHeader className="border-b border-slate-100 p-5">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Allocate Students
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {step === 1
                ? "Select the student(s) you want to allocate."
                : "Choose a supervisor to assign the selected student(s) to."}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                step === 1
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  step === 1
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-300 text-white",
                )}
              >
                1
              </span>
              Select Students
            </div>
            <ArrowRight className="h-3 w-3 text-slate-300" />
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                step === 2
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  step === 2
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-300 text-white",
                )}
              >
                2
              </span>
              Select Supervisor
            </div>
          </div>

          {/* Step 1: Select Students */}
          {step === 1 && (
            <>
              <div className="border-b border-slate-100 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, or matric…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="rounded-lg pl-9"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {studentsLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={UsersIcon}
                      title={
                        studentSearch ? "No matches" : "No unallocated students"
                      }
                      description={
                        studentSearch
                          ? "Try a different search term."
                          : "All students already have an active allocation."
                      }
                    />
                  </div>
                ) : (
                  filteredStudents.map((s) => {
                    const checked = selectedStudentIds.has(s.id)
                    return (
                      <label
                        key={s.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                          checked
                            ? "border-emerald-300 bg-emerald-50/50"
                            : "border-transparent hover:bg-slate-50",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleStudent(s.id)}
                        />
                        <UserAvatar name={s.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {s.name}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {s.matricNo ?? s.email}
                          </p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </>
          )}

          {/* Step 2: Select Supervisor */}
          {step === 2 && (
            <>
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Allocating{" "}
                    <span className="font-semibold text-slate-800">
                      {selectedStudentIds.size}
                    </span>{" "}
                    student{selectedStudentIds.size === 1 ? "" : "s"}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="text-xs text-slate-500"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Edit selection
                  </Button>
                </div>
                {/* Selected students chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from(selectedStudentIds).map((id) => {
                    const s = allStudents?.find((u) => u.id === id)
                    if (!s) return null
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() => toggleStudent(id)}
                          className="text-emerald-400 hover:text-emerald-700"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {supervisorsLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : availableSupervisors.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={AlertCircle}
                      title="No available supervisors"
                      description="All supervisors have reached their maximum student capacity. Increase a supervisor's max capacity on the Users page first."
                    />
                  </div>
                ) : (
                  availableSupervisors.map((sup) => {
                    const selected = selectedSupervisorId === sup.id
                    const load = sup.supervisorProfile?.currentLoad ?? 0
                    const max = sup.supervisorProfile?.maxStudents ?? 5
                    const pct = Math.min((load / max) * 100, 100)
                    const remaining = max - load
                    const wouldExceed = selectedStudentIds.size > remaining
                    return (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => setSelectedSupervisorId(sup.id)}
                        className={cn(
                          "mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          selected
                            ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        <UserAvatar name={sup.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {sup.name}
                            </p>
                            {selected && (
                              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-400">
                            {sup.supervisorProfile?.specialization ?? "—"}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress
                              value={pct}
                              className={cn(
                                "h-1.5 flex-1",
                                pct >= 100
                                  ? "[&>div]:bg-rose-500"
                                  : pct >= 70
                                    ? "[&>div]:bg-amber-500"
                                    : "[&>div]:bg-emerald-500",
                              )}
                            />
                            <span className="shrink-0 text-xs font-medium text-slate-500">
                              {load}/{max}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {wouldExceed ? (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700"
                            >
                              Exceeds
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                remaining <= 2
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                              }
                            >
                              {remaining} slot{remaining === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
              {selectedSupervisorId && selectedSupervisor && (() => {
                const load =
                  selectedSupervisor.supervisorProfile?.currentLoad ?? 0
                const max = selectedSupervisor.supervisorProfile?.maxStudents ?? 5
                const wouldExceed = selectedStudentIds.size > max - load
                if (wouldExceed) {
                  return (
                    <div className="border-t border-amber-100 bg-amber-50/50 px-5 py-3">
                      <p className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertCircle className="h-4 w-4" />
                        Selecting {selectedStudentIds.size} student
                        {selectedStudentIds.size === 1 ? "" : "s"} would exceed{" "}
                        {selectedSupervisor.name}&apos;s remaining capacity.
                      </p>
                    </div>
                  )
                }
                return null
              })()}
            </>
          )}

          <DialogFooter className="border-t border-slate-100 p-4">
            <Button
              variant="ghost"
              onClick={closeModal}
              className="rounded-lg text-slate-500"
            >
              Cancel
            </Button>
            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={selectedStudentIds.size === 0}
                className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => allocateMutation.mutate()}
                disabled={
                  !selectedSupervisorId ||
                  allocateMutation.isPending ||
                  (!!selectedSupervisor &&
                    selectedStudentIds.size >
                      (selectedSupervisor.supervisorProfile?.maxStudents ?? 5) -
                        (selectedSupervisor.supervisorProfile?.currentLoad ?? 0))
                }
                className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {allocateMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                Allocate {selectedStudentIds.size} Student
                {selectedStudentIds.size === 1 ? "" : "s"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Revoke allocation for ${revokeTarget?.studentName}?`}
        description={`This will remove ${revokeTarget?.studentName} from ${revokeTarget?.supervisorName}'s supervision. The student will need to be re-allocated. This action cannot be undone.`}
        confirmText="Revoke"
        variant="destructive"
        onConfirm={async () => {
          if (revokeTarget) {
            await revokeMutation.mutateAsync(revokeTarget.id)
          }
        }}
      />
    </div>
  )
}
