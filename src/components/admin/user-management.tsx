"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Power,
  Loader2,
  Eye,
  EyeOff,
  Users as UsersIcon,
} from "lucide-react"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  department: string | null
  matricNo: string | null
  staffId: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  level: string | null
  programme: string | null
  supervisorName: string | null
  currentLoad: number | null
  maxStudents: number | null
  specialization: string | null
}

const roleVariant: Record<UserRole, string> = {
  ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  SUPERVISOR: "bg-emerald-100 text-emerald-700 border-emerald-200",
  STUDENT: "bg-slate-100 text-slate-600 border-slate-200",
}

// --- Zod schemas ---
const addUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email"),
    role: z.enum(["STUDENT", "SUPERVISOR"]),
    matricNo: z.string().optional(),
    staffId: z.string().optional(),
    specialization: z.string().optional(),
    maxStudents: z.coerce.number().min(1).max(20).default(5),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role !== "STUDENT" || !!data.matricNo, {
    message: "Matric number is required for students",
    path: ["matricNo"],
  })
  .refine((data) => data.role !== "SUPERVISOR" || !!data.staffId, {
    message: "Staff ID is required for supervisors",
    path: ["staffId"],
  })

type AddUserForm = z.infer<typeof addUserSchema>

const editUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  department: z.string().optional(),
})

type EditUserForm = z.infer<typeof editUserSchema>

export function UserManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // --- Fetch users (debounced search via state) ---
  const { data, isLoading } = useQuery<{
    data: UserRow[]
    pagination: { total: number; page: number; totalPages: number }
  }>({
    queryKey: ["users", roleFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (roleFilter !== "ALL") params.set("role", roleFilter)
      if (search) params.set("search", search)
      params.set("limit", "50")
      const res = await fetch(
        `/api/users?${params.toString()}`,
      )
      const json = await res.json()
      return json
    },
  })

  const users = data?.data ?? []

  // --- Add user mutation ---
  const addMutation = useMutation({
    mutationFn: async (form: AddUserForm) => {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
      }
      if (form.role === "STUDENT") {
        payload.matricNo = form.matricNo
      } else {
        payload.staffId = form.staffId
        payload.specialization = form.specialization
        payload.maxStudents = form.maxStudents
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to add user")
      return json
    },
    onSuccess: () => {
      toast.success("User added successfully")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setAddDialogOpen(false)
      addForm.reset()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // --- Edit user mutation ---
  const editMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: EditUserForm }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone ?? null,
          department: form.department ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to update user")
      return json
    },
    onSuccess: () => {
      toast.success("User updated successfully")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setEditTarget(null)
      editForm.reset()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // --- Deactivate/Activate mutation ---
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to update status")
      return json
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setDeactivateTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // --- Forms ---
  const addForm = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "STUDENT",
      matricNo: "",
      staffId: "",
      specialization: "",
      maxStudents: 5,
      password: "",
      confirmPassword: "",
    },
  })

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
  })

  const watchRole = addForm.watch("role")

  const openEdit = (user: UserRow) => {
    editForm.reset({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      department: user.department ?? "",
    })
    setEditTarget(user)
  }

  const onSubmitAdd = (values: AddUserForm) => addMutation.mutate(values)
  const onSubmitEdit = (values: EditUserForm) => {
    if (editTarget) editMutation.mutate({ id: editTarget.id, form: values })
  }

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
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Add and manage students, supervisors, and administrators
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add User
        </Button>
      </motion.div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border-slate-200 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={roleFilter}
              onValueChange={(v) => setRoleFilter(v as "ALL" | UserRole)}
            >
              <SelectTrigger className="w-[160px] rounded-lg">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="STUDENT">Students</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisors</SelectItem>
                <SelectItem value="ADMIN">Admins</SelectItem>
              </SelectContent>
            </Select>
            <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:inline">
              {users.length} user{users.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                User
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Department
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ID Number
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Supervisor / Load
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <EmptyState
                    icon={UsersIcon}
                    title="No users found"
                    description="Try adjusting your search or filter to find what you're looking for."
                  />
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-slate-100 transition-colors hover:bg-slate-50/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${roleVariant[user.role]}`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {user.department ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {user.matricNo ?? user.staffId ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.role === "STUDENT" ? (
                      user.supervisorName ? (
                        <span className="text-slate-600">
                          {user.supervisorName}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not assigned</span>
                      )
                    ) : user.role === "SUPERVISOR" ? (
                      <span className="text-slate-600">
                        {user.currentLoad}/{user.maxStudents} students
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label="User actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => openEdit(user)}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeactivateTarget(user)}
                          className="cursor-pointer text-rose-600 focus:text-rose-700"
                        >
                          <Power className="mr-2 h-3.5 w-3.5" />
                          {user.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && users.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-400">
              Showing {users.length} of {data?.pagination.total ?? 0} user
              {data?.pagination.total === 1 ? "" : "s"} · Joined between{" "}
              {users[users.length - 1] &&
                format(new Date(users[users.length - 1].createdAt), "MMM yyyy")}{" "}
              and{" "}
              {users[0] && format(new Date(users[0].createdAt), "MMM yyyy")}
            </p>
          </div>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Add New User</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={addForm.handleSubmit(onSubmitAdd)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="add-name" className="text-sm text-slate-700">
                Full Name
              </Label>
              <Input
                id="add-name"
                {...addForm.register("name")}
                placeholder="e.g. James Okafor"
                className="rounded-lg"
              />
              {addForm.formState.errors.name && (
                <p className="text-xs text-rose-500">
                  {addForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email" className="text-sm text-slate-700">
                Email
              </Label>
              <Input
                id="add-email"
                type="email"
                {...addForm.register("email")}
                placeholder="user@psms.edu"
                className="rounded-lg"
              />
              {addForm.formState.errors.email && (
                <p className="text-xs text-rose-500">
                  {addForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-slate-700">Role</Label>
              <RadioGroup
                value={addForm.watch("role")}
                onValueChange={(v) =>
                  addForm.setValue("role", v as "STUDENT" | "SUPERVISOR")
                }
                className="grid grid-cols-2 gap-3"
              >
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                    addForm.watch("role") === "STUDENT"
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <RadioGroupItem value="STUDENT" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Student
                    </p>
                    <p className="text-xs text-slate-500">
                      Create a student account
                    </p>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                    addForm.watch("role") === "SUPERVISOR"
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <RadioGroupItem value="SUPERVISOR" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Supervisor
                    </p>
                    <p className="text-xs text-slate-500">
                      Create a supervisor account
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Role-conditional fields */}
            {watchRole === "STUDENT" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="add-matric"
                  className="text-sm text-slate-700"
                >
                  Matriculation Number{" "}
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="add-matric"
                  {...addForm.register("matricNo")}
                  placeholder="CS/2021/001"
                  className="rounded-lg"
                />
                {addForm.formState.errors.matricNo && (
                  <p className="text-xs text-rose-500">
                    {addForm.formState.errors.matricNo.message}
                  </p>
                )}
              </div>
            )}

            {watchRole === "SUPERVISOR" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label
                    htmlFor="add-staffid"
                    className="text-sm text-slate-700"
                  >
                    Staff ID <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="add-staffid"
                    {...addForm.register("staffId")}
                    placeholder="STF/001"
                    className="rounded-lg"
                  />
                  {addForm.formState.errors.staffId && (
                    <p className="text-xs text-rose-500">
                      {addForm.formState.errors.staffId.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label
                    htmlFor="add-spec"
                    className="text-sm text-slate-700"
                  >
                    Specialization
                  </Label>
                  <Input
                    id="add-spec"
                    {...addForm.register("specialization")}
                    placeholder="Machine Learning"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label
                    htmlFor="add-max"
                    className="text-sm text-slate-700"
                  >
                    Max Students
                  </Label>
                  <Input
                    id="add-max"
                    type="number"
                    min={1}
                    max={20}
                    {...addForm.register("maxStudents", {
                      setValueAs: (v) =>
                        v === "" || v === null ? 5 : Number(v),
                    })}
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="add-password" className="text-sm text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="add-password"
                  type={showPassword ? "text" : "password"}
                  {...addForm.register("password")}
                  placeholder="Minimum 8 characters"
                  className="rounded-lg pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {addForm.formState.errors.password && (
                <p className="text-xs text-rose-500">
                  {addForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="add-confirm"
                className="text-sm text-slate-700"
              >
                Confirm Password
              </Label>
              <Input
                id="add-confirm"
                type={showPassword ? "text" : "password"}
                {...addForm.register("confirmPassword")}
                placeholder="Re-enter password"
                className="rounded-lg"
              />
              {addForm.formState.errors.confirmPassword && (
                <p className="text-xs text-rose-500">
                  {addForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
              >
                {addMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Edit User</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(onSubmitEdit)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-700">Full Name</Label>
              <Input
                {...editForm.register("name")}
                className="rounded-lg"
              />
              {editForm.formState.errors.name && (
                <p className="text-xs text-rose-500">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-700">Email</Label>
              <Input
                type="email"
                {...editForm.register("email")}
                className="rounded-lg"
              />
              {editForm.formState.errors.email && (
                <p className="text-xs text-rose-500">
                  {editForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-700">Phone</Label>
                <Input
                  {...editForm.register("phone")}
                  placeholder="Optional"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-700">Department</Label>
                <Input
                  {...editForm.register("department")}
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Role and password cannot be changed here. Use the deactivate
              action to suspend access.
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
              >
                {editMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate / Activate confirmation */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={`${deactivateTarget?.isActive ? "Deactivate" : "Activate"} ${deactivateTarget?.name}?`}
        description={
          deactivateTarget?.isActive
            ? "They will no longer be able to log in. You can reactivate the account at any time."
            : "The user will regain access to the system immediately."
        }
        confirmText={deactivateTarget?.isActive ? "Deactivate" : "Activate"}
        variant={deactivateTarget?.isActive ? "destructive" : "default"}
        onConfirm={async () => {
          if (deactivateTarget) {
            await deactivateMutation.mutateAsync(deactivateTarget.id)
          }
        }}
      />
    </div>
  )
}
