"use client"

import * as React from "react"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  footer?: React.ReactNode
  delay?: number
  /** Remove the default padding on the body region (use when child supplies own padding) */
  flushBody?: boolean
  /** Hide the divider between header and body */
  noHeaderDivider?: boolean
  /** Render without the hover shadow lift */
  flat?: boolean
}

/**
 * SectionCard — a structured, standardised surface used across dashboards.
 *
 * Visual contract:
 *  - White surface, 1px slate-200/80 border, rounded-xl, subtle shadow.
 *  - Optional header row: emerald icon chip + title (sm semibold slate-900) +
 *    description (xs slate-500), optional action on the right.
 *  - Optional header→body divider (slate-100) for clear separation.
 *  - Optional footer with top divider.
 *
 * Designed so headings are easily distinguishable from body text and every
 * section/category looks neat and consistent.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  footer,
  delay = 0,
  flushBody = false,
  noHeaderDivider = false,
  flat = false,
}: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm",
        !flat && "transition-shadow hover:shadow-md",
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-5 py-4",
          !noHeaderDivider && "border-b border-slate-100",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Body */}
      <div
        className={cn(
          "flex-1",
          !flushBody && "px-5 py-4",
          bodyClassName,
        )}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3">
          {footer}
        </div>
      )}
    </motion.div>
  )
}
