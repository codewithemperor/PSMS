"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  User,
  Mail,
  Phone,
  Building2,
  Save,
  Loader2,
  Shield,
  Calendar,
  IdCard,
  GraduationCap,
  Briefcase,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useAuthStore } from "@/stores/auth-store"

interface MyProfile {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  phone: string | null
  avatar: string | null
  matricNo: string | null
  staffId: string | null
  createdAt: string
  studentProfile: {
    level: string
    programme: string | null
    enrollmentYear: number | null
  } | null
  supervisorProfile: {
    specialization: string | null
    maxStudents: number
    currentLoad: number
    bio: string | null
  } | null
}

const roleBadge: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  SUPERVISOR: "bg-emerald-100 text-emerald-700",
  STUDENT: "bg-teal-100 text-teal-700",
}

export function Settings() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [bio, setBio] = useState("")

  // Fetch profile
  useEffect(() => {
    let mounted = true
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        const d = json.data as MyProfile
        setProfile(d)
        setName(d.name)
        setPhone(d.phone ?? "")
        setDepartment(d.department ?? "")
        setBio(d.supervisorProfile?.bio ?? "")
      })
      .catch(() => toast.error("Failed to load profile"))
    return () => {
      mounted = false
    }
  }, [])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          department: department.trim(),
          bio: user?.role === "SUPERVISOR" ? bio.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Update failed")
      return json
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["me"] })
      // Update auth store if name changed
      if (user && data.data.name !== user.name) {
        // Note: full session refresh would require signIn again; for now, just toast
        toast.info("Refresh the page to see your updated name in the header.")
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate()
  }

  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  const isSupervisor = profile.role === "SUPERVISOR"
  const isStudent = profile.role === "STUDENT"

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile information
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile summary (read-only) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Account Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col items-center pb-3">
                <UserAvatar name={profile.name} size="lg" />
                <p className="mt-3 text-base font-bold text-slate-800">
                  {profile.name}
                </p>
                <Badge
                  className={`mt-1 ${roleBadge[profile.role] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {profile.role}
                </Badge>
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate text-xs">{profile.email}</span>
                </div>
                {profile.matricNo && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <IdCard className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono text-xs">
                      {profile.matricNo}
                    </span>
                  </div>
                )}
                {profile.staffId && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <IdCard className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono text-xs">
                      {profile.staffId}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs">
                    Joined{" "}
                    {new Date(profile.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Student-specific */}
              {isStudent && profile.studentProfile && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Student Profile
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                    Level {profile.studentProfile.level}
                  </div>
                  {profile.studentProfile.programme && (
                    <p className="text-xs text-slate-500">
                      {profile.studentProfile.programme}
                    </p>
                  )}
                </div>
              )}

              {/* Supervisor-specific */}
              {isSupervisor && profile.supervisorProfile && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Supervisor Profile
                  </p>
                  {profile.supervisorProfile.specialization && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      {profile.supervisorProfile.specialization}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    Load: {profile.supervisorProfile.currentLoad}/
                    {profile.supervisorProfile.maxStudents}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
                <Shield className="h-3.5 w-3.5" />
                <span>Email & ID cannot be changed</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      className="rounded-lg pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm text-slate-700">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="rounded-lg pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="department"
                    className="text-sm text-slate-700"
                  >
                    Department
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="rounded-lg pl-9"
                    />
                  </div>
                </div>

                {isSupervisor && (
                  <div className="space-y-1.5">
                    <Label htmlFor="bio" className="text-sm text-slate-700">
                      Bio / Research Interests
                    </Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Briefly describe your research interests and expertise..."
                      rows={4}
                      className="rounded-lg"
                    />
                    <p className="text-[11px] text-slate-400">
                      Students will see this when choosing a supervisor.
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      updateMutation.isPending || name.trim().length < 2
                    }
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
