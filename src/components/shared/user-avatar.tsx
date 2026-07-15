"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface UserAvatarProps {
  name: string
  email?: string
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
}

// Soft pastel palette — no indigo/blue/purple
const palette = [
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-slate-100 text-slate-700",
  "bg-green-100 text-green-700",
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({ name, email, size = "md" }: UserAvatarProps) {
  const initials = getInitials(name)
  const colorClass = palette[hashString(name) % palette.length]

  const avatar = (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${colorClass} ${sizeMap[size]}`}
    >
      {initials}
    </div>
  )

  if (email) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              {avatar}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-slate-400">{email}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return avatar
}
