"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserCheck,
  FileCheck,
  FolderKanban,
  BarChart3,
  FileBarChart,
  MessageSquare,
  Settings,
  FileText,
  FilePlus,
  Upload,
  TrendingUp,
  MessageCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { useNotificationStore } from "@/stores/notification-store"
import { useAppConfig } from "@/stores/app-config-store"
import { UserAvatar } from "@/components/shared/user-avatar"

type Role = "ADMIN" | "SUPERVISOR" | "STUDENT"

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
}

const navConfig: Record<Role, NavItem[]> = {
  ADMIN: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: Users, label: "User Management", href: "/admin/users" },
    { icon: UserCheck, label: "Supervisor Allocation", href: "/admin/allocations" },
    { icon: FileCheck, label: "Topic Approval", href: "/admin/topics" },
    { icon: FolderKanban, label: "All Projects", href: "/admin/projects" },
    { icon: BarChart3, label: "Department Overview", href: "/admin/overview" },
    { icon: FileBarChart, label: "Reports", href: "/admin/reports" },
    { icon: MessageSquare, label: "Messages", href: "/admin/messages" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ],
  SUPERVISOR: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/supervisor/dashboard" },
    { icon: GraduationCap, label: "My Students", href: "/supervisor/students" },
    { icon: FileCheck, label: "Topic Reviews", href: "/supervisor/topics" },
    { icon: FileText, label: "Document Reviews", href: "/supervisor/documents" },
    { icon: MessageSquare, label: "Messages", href: "/supervisor/messages" },
    { icon: Settings, label: "Settings", href: "/supervisor/settings" },
  ],
  STUDENT: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/student/dashboard" },
    { icon: FolderKanban, label: "My Project", href: "/student/project" },
    { icon: FilePlus, label: "Submit Topic", href: "/student/topic" },
    { icon: Upload, label: "Upload Document", href: "/student/upload" },
    { icon: TrendingUp, label: "My Progress", href: "/student/progress" },
    { icon: MessageCircle, label: "Feedback History", href: "/student/feedback" },
    { icon: MessageSquare, label: "Messages", href: "/student/messages" },
    { icon: Settings, label: "Settings", href: "/student/settings" },
  ],
}

const roleBadge: Record<Role, string> = {
  ADMIN: "bg-white/20 text-white",
  SUPERVISOR: "bg-white/20 text-white",
  STUDENT: "bg-white/20 text-white",
}

interface AppSidebarProps {
  role: Role
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const { appShortName, logoUrl } = useAppConfig()
  const [collapsed, setCollapsed] = useState(false)
  const items = navConfig[role]

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-emerald-900/30 bg-gradient-to-b from-emerald-800 to-emerald-900 transition-all duration-300 md:flex ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-emerald-700/40 px-4">
        <Link
          href={`/${role.toLowerCase()}/dashboard`}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          {logoUrl ? (
             
            <img
              src={logoUrl}
              alt={`${appShortName} logo`}
              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/20"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          {!collapsed && (
            <span className="text-lg font-bold text-white">{appShortName}</span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1.5 text-emerald-200 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role.toLowerCase()}/dashboard` &&
              pathname.startsWith(item.href))
          const Icon = item.icon
          const showBadge =
            item.label === "Messages" && unreadCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "bg-white/15 font-semibold text-white shadow-sm"
                  : "text-emerald-50/80 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isActive
                    ? "text-white"
                    : "text-emerald-200/70 group-hover:text-white"
                }`}
              />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {collapsed && showBadge && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer — user + sign out */}
      <div className="border-t border-emerald-700/40 p-3">
        <div
          className={`flex items-center gap-3 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <UserAvatar name={user?.name ?? "User"} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.name}
              </p>
              <span
                className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${roleBadge[role]}`}
              >
                {role}
              </span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-emerald-100 transition-colors hover:bg-rose-500/80 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-3 flex w-full items-center justify-center rounded-lg p-2 text-emerald-100 transition-colors hover:bg-rose-500/80 hover:text-white"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  )
}

// Keep AnimatePresence import alive for future view transitions
void AnimatePresence
void motion
