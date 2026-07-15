"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50">
        <Icon className="h-10 w-10 text-slate-300" />
      </div>
      <h3 className="mt-5 text-lg font-medium text-slate-600">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-center text-sm text-slate-400">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
