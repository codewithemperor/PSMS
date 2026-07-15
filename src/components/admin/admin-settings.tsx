"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Settings as SettingsIcon,
  Building2,
  KeyRound,
  Save,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  Clock,
  Eye,
  EyeOff,
  Users,
  Minus,
  Plus,
  Info,
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
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/shared/user-avatar"
import { invalidateAppConfig } from "@/stores/app-config-store"

interface SystemConfig {
  id: string
  appName: string
  appShortName: string
  logoUrl: string | null
  maxStudentsPerSupervisor: number
  updatedAt: string
}

interface ConfigResponse {
  success: boolean
  data: SystemConfig
}

export function AdminSettings() {
  const queryClient = useQueryClient()

  // --- App identity form state ---
  const [appName, setAppName] = useState("")
  const [appShortName, setAppShortName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")

  // --- Password form state ---
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)

  // --- Capacity form state ---
  const [maxStudents, setMaxStudents] = useState(5)

  // Track whether the identity form has been hydrated from the server config.
  // Without this, the useState("") defaults would overwrite the loaded values
  // on first render.
  const [hydrated, setHydrated] = useState(false)

  // --- Fetch system config ---
  const { data: config, isLoading } = useQuery<SystemConfig>({
    queryKey: ["system-config"],
    queryFn: async () => {
      const res = await fetch("/api/system-config")
      const json: ConfigResponse = await res.json()
      if (!res.ok || !json.success) {
        throw new Error("Failed to load system config")
      }
      return json.data
    },
  })

  // Hydrate the identity form once the config has loaded.
  if (config && !hydrated) {
    setAppName(config.appName)
    setAppShortName(config.appShortName)
    setLogoUrl(config.logoUrl ?? "")
    setMaxStudents(config.maxStudentsPerSupervisor ?? 5)
    setHydrated(true)
  }

  const identityDirty =
    !!config &&
    (appName !== config.appName ||
      appShortName !== config.appShortName ||
      logoUrl !== (config.logoUrl ?? ""))

  const capacityDirty =
    !!config && maxStudents !== config.maxStudentsPerSupervisor

  // --- Save identity mutation ---
  const saveIdentityMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/system-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          appShortName,
          logoUrl: logoUrl || "",
          maxStudentsPerSupervisor: maxStudents,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save settings")
      }
      return json.data as SystemConfig
    },
    onSuccess: () => {
      toast.success("Settings saved. Changes are now live across the app.")
      queryClient.invalidateQueries({ queryKey: ["system-config"] })
      // Invalidate the public app-config cache so the sidebar, header,
      // footer, login page and document title all pick up the new
      // app name / short name / logo immediately.
      invalidateAppConfig()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // --- Change password mutation ---
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/system-config/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to change password")
      }
      return json
    },
    onSuccess: () => {
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveIdentityMutation.mutate()
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    changePasswordMutation.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Manage application name, logo, and admin credentials.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-40 rounded-xl lg:col-span-2" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* App Identity Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="rounded-xl border-emerald-100 bg-white shadow-sm">
              <CardHeader className="rounded-t-xl bg-emerald-50/30">
                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                  App Identity
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Customize the application name and logo shown across the
                  system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIdentitySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="app-name"
                      className="text-sm text-slate-700"
                    >
                      App Name
                    </Label>
                    <Input
                      id="app-name"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="PSMS — Project Supervision Management System"
                      className="rounded-lg"
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="app-short-name"
                      className="text-sm text-slate-700"
                    >
                      App Short Name
                    </Label>
                    <Input
                      id="app-short-name"
                      value={appShortName}
                      onChange={(e) => setAppShortName(e.target.value)}
                      placeholder="PSMS"
                      className="rounded-lg"
                      maxLength={20}
                    />
                    <p className="text-xs text-slate-400">
                      Used in the browser tab title and sidebar.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="logo-url"
                      className="text-sm text-slate-700"
                    >
                      Logo URL
                    </Label>
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <UserAvatar
                          name={appShortName || "PSMS"}
                          size="md"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-full bg-slate-100">
                          <ImageIcon className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <Input
                        id="logo-url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="flex-1 rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Leave empty to use the default PSMS logo.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      saveIdentityMutation.isPending || !identityDirty
                    }
                    className="w-full rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {saveIdentityMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Admin Password Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="rounded-xl border-rose-100 bg-white shadow-sm">
              <CardHeader className="rounded-t-xl bg-rose-50/30">
                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                  <KeyRound className="h-5 w-5 text-rose-600" />
                  Admin Password
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Change your administrator account password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="current-password"
                      className="text-sm text-slate-700"
                    >
                      Current Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="rounded-lg pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label="Toggle password visibility"
                      >
                        {showPasswords ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="new-password"
                      className="text-sm text-slate-700"
                    >
                      New Password
                    </Label>
                    <Input
                      id="new-password"
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="confirm-password"
                      className="text-sm text-slate-700"
                    >
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="rounded-lg"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      changePasswordMutation.isPending ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="w-full rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-1.5 h-4 w-4" />
                    )}
                    Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Supervisor Capacity Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Card className="rounded-xl border-teal-100 bg-white shadow-sm">
              <CardHeader className="rounded-t-xl bg-teal-50/30">
                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                  <Users className="h-5 w-5 text-teal-600" />
                  Supervisor Capacity
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Set the maximum number of students each supervisor can be
                  allocated. Lowering this does not remove existing
                  allocations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="max-students"
                      className="text-sm text-slate-700"
                    >
                      Max Students per Supervisor
                    </Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setMaxStudents((m) => Math.max(1, m - 1))
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        disabled={maxStudents <= 1}
                        aria-label="Decrease"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <Input
                        id="max-students"
                        type="number"
                        min={1}
                        max={100}
                        value={maxStudents}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (!Number.isNaN(v)) {
                            setMaxStudents(Math.min(100, Math.max(1, v)))
                          }
                        }}
                        className="rounded-lg text-center text-lg font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setMaxStudents((m) => Math.min(100, m + 1))
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        disabled={maxStudents >= 100}
                        aria-label="Increase"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Applied when admins allocate students on the Supervisor
                      Allocation page.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-teal-200 bg-teal-50/60 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <p className="text-xs leading-relaxed text-teal-800">
                      If a supervisor already has more students than the new
                      limit, those students stay assigned — only{" "}
                      <span className="font-medium">new</span> allocations are
                      blocked until the supervisor drops below the cap.
                    </p>
                  </div>

                  <Button
                    onClick={() => saveIdentityMutation.mutate()}
                    disabled={
                      saveIdentityMutation.isPending || !capacityDirty
                    }
                    className="w-full rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                  >
                    {saveIdentityMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Save Capacity
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* System Information Card — full width */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2"
          >
            <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                  <CheckCircle2 className="h-5 w-5 text-slate-500" />
                  System Information
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Read-only summary of the current system configuration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      App Name
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">
                      {config?.appName ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Short Name
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">
                      {config?.appShortName ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Logo
                    </p>
                    <div className="mt-1">
                      {config?.logoUrl ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Set
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-500"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Last Updated
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-800">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {config
                        ? format(new Date(config.updatedAt), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  )
}
