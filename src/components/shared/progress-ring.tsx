"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"
import { useEffect } from "react"

interface ProgressRingProps {
  percentage: number
  size?: number
  strokeWidth?: number
  label?: string
}

/**
 * ProgressRing — a circular progress indicator.
 *
 * Design rule: a single emerald stroke for every state. The previous
 * behaviour coloured the ring red (<30%) / amber (<60%) / green (else),
 * which added decorative multi-colour. Now the ring is always emerald and
 * the numeric percentage is rendered in slate-900 — cleaner and consistent
 * with the rest of the dashboard.
 */
export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
  label,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percentage))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  const color = "#10b981" // emerald-500 — single accent

  const motionOffset = useMotionValue(circumference)
  const animatedOffset = useTransform(motionOffset, (v) => v)

  useEffect(() => {
    motionOffset.set(offset)
  }, [offset, motionOffset])

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: animatedOffset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold tabular-nums text-slate-900"
          style={{ fontSize: size * 0.24 }}
        >
          {clamped}%
        </span>
        {label && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
