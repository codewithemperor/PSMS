"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Users,
  FileCheck,
  MessageCircle,
  TrendingUp,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { useAppConfig } from "@/stores/app-config-store"

const demoLogins = [
  {
    role: "Admin",
    email: "admin@psms.edu",
    description: "Full access · manage users, allocations, oversight",
    tone: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  {
    role: "Supervisor",
    email: "supervisor1@psms.edu",
    description: "Review topics, documents, give feedback",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    role: "Student",
    email: "student1@psms.edu",
    description: "Submit topics, upload documents, track progress",
    tone: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
  },
]

const features = [
  {
    icon: FileCheck,
    title: "Topic Approval Workflow",
    description: "Submit, review, and approve project topics with auto project creation.",
  },
  {
    icon: Users,
    title: "Smart Allocation",
    description: "Match students to supervisors with capacity tracking and load balancing.",
  },
  {
    icon: MessageCircle,
    title: "Structured Feedback",
    description: "Document-level feedback with status tracking and student notifications.",
  },
  {
    icon: TrendingUp,
    title: "Milestone Tracking",
    description: "Weighted progress auto-calculation as milestones complete.",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const { appName, appShortName, logoUrl } = useAppConfig()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.ok) {
        const session = await getSession()
        const role = session?.user?.role
        const target =
          role === "ADMIN"
            ? "/admin/dashboard"
            : role === "SUPERVISOR"
              ? "/supervisor/dashboard"
              : "/student/dashboard"
        toast.success(`Welcome back, ${session?.user?.name?.split(" ")[0]}!`)
        router.push(target)
      } else {
        setError("Invalid email or password")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword("password123")
    setError("")
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: feature panel (hidden on mobile) */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-300/10 blur-3xl" />
        </div>

        {/* Brand + headline */}
        <div className="relative">
          <div className="flex items-center gap-3">
            {logoUrl ? (
               
              <img
                src={logoUrl}
                alt={`${appShortName} logo`}
                className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <GraduationCap className="h-7 w-7" />
              </div>
            )}
            <div>
              <p className="text-xl font-bold">{appShortName}</p>
              <p className="text-xs text-emerald-100">{appName}</p>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <h1 className="text-3xl font-bold leading-tight">
              Manage student projects end-to-end.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100">
              From topic submission to final defense — streamline supervision,
              feedback, and progress tracking for your entire department.
            </p>
          </div>
        </div>

        {/* Features grid */}
        <div className="relative grid grid-cols-2 gap-4">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <Icon className="h-5 w-5 text-emerald-200" />
                <p className="mt-2 text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                  {f.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Trust footer */}
        <div className="relative flex items-center gap-2 text-xs text-emerald-100/70">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Role-based access · Secured by NextAuth</span>
        </div>
      </div>

      {/* Right: login form */}
      <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-8">
        {/* Mobile-only brand */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-emerald-100/30 blur-3xl" />
          <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-teal-100/20 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-md"
        >
          <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm">
            {/* Branding (mobile shows full, desktop shows compact) */}
            <div className="mb-7 flex flex-col items-center">
              {logoUrl ? (
                 
                <img
                  src={logoUrl}
                  alt={`${appShortName} logo`}
                  className="mb-3 h-14 w-14 rounded-xl object-cover shadow-sm ring-1 ring-emerald-200"
                />
              ) : (
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                  <GraduationCap className="h-8 w-8" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-slate-800">{appShortName}</h1>
              <p className="text-sm text-slate-500">{appName}</p>
              <div className="mt-4 h-0.5 w-16 rounded-full bg-emerald-500" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-emerald-400"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </button>
            </form>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200/60 bg-rose-50 p-3"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <p className="text-sm text-rose-600">{error}</p>
              </motion.div>
            )}

            {/* Demo quick-fill */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-xs font-semibold text-slate-600">
                  Demo accounts — click to auto-fill
                </p>
              </div>
              <div className="space-y-2">
                {demoLogins.map((demo) => (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() => quickFill(demo.email)}
                    className={`flex w-full items-start gap-2.5 rounded-lg border ${demo.tone} p-2.5 text-left transition-all hover:shadow-sm`}
                  >
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${demo.dot}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{demo.role}</span>
                        <span className="font-mono text-[10px] opacity-70">
                          password123
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] opacity-80">
                        {demo.email}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight opacity-70">
                        {demo.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Contact your administrator for account setup
            </p>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-300">
            © {new Date().getFullYear()} {appShortName} · Department of Computer Science
          </p>
        </motion.div>
      </div>
    </div>
  )
}
