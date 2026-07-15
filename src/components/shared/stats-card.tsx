"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: "up" | "down"
  trendValue?: string
  delay?: number
  /**
   * Kept for backwards-compatibility only. The new unified design ignores
   * `tone` and always uses the emerald accent so every card looks neat and
   * standard (no decorative multi-colour).
   */
  tone?: string
}

/**
 * StatsCard — a single standard metric tile.
 *
 * Design rules:
 *  - ONE accent colour (emerald) for all cards. No decorative multi-colour.
 *  - Strong typographic hierarchy:
 *      • title  → 11px uppercase tracked slate-400 (label)
 *      • value  → 3xl bold tabular-nums slate-900 (the hero)
 *      • footer → xs slate-400 (context / trend)
 *  - A 2px emerald accent strip at the top ties every card to the brand.
 *  - Icon chip uses emerald-50 / emerald-600 with a subtle inset ring.
 *
 * The previous `tone` prop has been intentionally removed: every stat now
 * shares the same green accent so the row reads as a single, neat group.
 */
export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  delay = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      {/* Top accent strip — single emerald accent for every card */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 opacity-80"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {(description || (trend && trendValue)) && (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
          {trend && trendValue && (
            <div className="flex items-center gap-1">
              {trend === "up" ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span
                className={cn(
                  "text-xs font-semibold",
                  trend === "up" ? "text-emerald-600" : "text-slate-500",
                )}
              >
                {trendValue}
              </span>
            </div>
          )}
          {description && (
            <span className="truncate text-xs text-slate-400">
              {description}
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}

// Backwards-compat export. Older callers may still pass `tone="emerald"` —
// we accept and ignore it so the new unified style is always used.
export type StatsTone = "emerald"
