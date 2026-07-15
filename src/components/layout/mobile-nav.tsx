"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileCheck,
  MessageSquare,
  GraduationCap,
  FileText,
  FolderKanban,
  FilePlus,
  Upload,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useNotificationStore } from "@/stores/notification-store"

type Role = "ADMIN" | "SUPERVISOR" | "STUDENT"

interface MobileNavItem {
  icon: LucideIcon
  label: string
  href: string
}

const mobileNavConfig: Record<Role, MobileNavItem[]> = {
  ADMIN: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: UserCheck, label: "Allocations", href: "/admin/allocations" },
    { icon: FileCheck, label: "Topics", href: "/admin/topics" },
    { icon: MessageSquare, label: "Messages", href: "/admin/messages" },
  ],
  SUPERVISOR: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/supervisor/dashboard" },
    { icon: GraduationCap, label: "Students", href: "/supervisor/students" },
    { icon: FileCheck, label: "Topics", href: "/supervisor/topics" },
    { icon: FileText, label: "Documents", href: "/supervisor/documents" },
    { icon: MessageSquare, label: "Messages", href: "/supervisor/messages" },
  ],
  STUDENT: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/student/dashboard" },
    { icon: FolderKanban, label: "Project", href: "/student/project" },
    { icon: FilePlus, label: "Topic", href: "/student/topic" },
    { icon: Upload, label: "Upload", href: "/student/upload" },
    { icon: MessageSquare, label: "Messages", href: "/student/messages" },
  ],
}

interface MobileNavProps {
  role: Role
}

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const items = mobileNavConfig[role]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-slate-200/60 bg-white/90 backdrop-blur-md md:hidden">
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
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive
                ? "text-emerald-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {showBadge && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-600" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
