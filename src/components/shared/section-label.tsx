"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionLabelProps {
  children: React.ReactNode
  className?: string
  /** Optional small caption rendered on the right of the label */
  hint?: React.ReactNode
}

/**
 * SectionLabel — a small uppercase tracked label used to group cards into
 * named sections/categories (e.g. "Overview", "Insights", "Activity").
 *
 * Visual contract:
 *  - 11px uppercase semibold, wide letter-spacing, slate-400.
 *  - A 3px emerald accent bar on the left ties it to the brand colour.
 *  - Optional hint on the right (xs slate-400).
 */
export function SectionLabel({
  children,
  className,
  hint,
}: SectionLabelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-0.5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-full bg-emerald-500" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {children}
        </h2>
      </div>
      {hint && (
        <span className="text-xs text-slate-400">{hint}</span>
      )}
    </div>
  )
}
