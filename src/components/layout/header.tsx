"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Menu,
  LogOut,
  User as UserIcon,
  ChevronDown,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { NotificationBell } from "@/components/shared/notification-bell"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useAuthStore } from "@/stores/auth-store"
import { preferredFirstName } from "@/lib/utils"
import { AppSidebar } from "./app-sidebar"
import { toast } from "sonner"

const breadcrumbMap: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/users": "User Management",
  "/admin/allocations": "Supervisor Allocation",
  "/admin/topics": "Topic Approval",
  "/admin/projects": "All Projects",
  "/admin/overview": "Department Overview",
  "/admin/reports": "Reports",
  "/admin/messages": "Messages",
  "/admin/settings": "Settings",
  "/supervisor/dashboard": "Dashboard",
  "/supervisor/students": "My Students",
  "/supervisor/topics": "Topic Reviews",
  "/supervisor/documents": "Document Reviews",
  "/supervisor/messages": "Messages",
  "/supervisor/settings": "Settings",
  "/student/dashboard": "Dashboard",
  "/student/project": "My Project",
  "/student/topic": "Submit Topic",
  "/student/upload": "Upload Document",
  "/student/progress": "My Progress",
  "/student/feedback": "Feedback History",
  "/student/messages": "Messages",
  "/student/settings": "Settings",
}

function getBreadcrumb(pathname: string): string {
  // Try exact match first
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]
  // Handle dynamic routes like /supervisor/students/[id]
  if (pathname.startsWith("/supervisor/students/")) return "Student Project"
  return "Dashboard"
}

function getRoleFromPath(pathname: string): "ADMIN" | "SUPERVISOR" | "STUDENT" {
  if (pathname.startsWith("/admin")) return "ADMIN"
  if (pathname.startsWith("/supervisor")) return "SUPERVISOR"
  return "STUDENT"
}

export function Header() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const role = getRoleFromPath(pathname)
  const breadcrumb = getBreadcrumb(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-md md:px-6">
      {/* Left: mobile menu + breadcrumb */}
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <AppSidebar role={role} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium uppercase tracking-wide text-slate-400 sm:inline">
            {role}
          </span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <h1 className="text-sm font-semibold text-slate-700 sm:text-base">
            {breadcrumb}
          </h1>
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-slate-100">
              <UserAvatar name={user?.name ?? "User"} size="sm" />
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                {preferredFirstName(user?.name)}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-700">
                {user?.name}
              </span>
              <span className="text-xs font-normal text-slate-400">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => toast.info("Profile page coming soon")}
              className="cursor-pointer rounded-lg"
            >
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="cursor-pointer rounded-lg text-rose-600 focus:text-rose-700"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// Keep Link import for potential future use
void Link
