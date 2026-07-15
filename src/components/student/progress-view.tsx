"use client"

import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { format, formatDistanceToNow, differenceInDays } from "date-fns"
import Link from "next/link"
import {
  TrendingUp,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Lightbulb,
  Calendar,
  Target,
  ChevronRight,
  Flag,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProgressRing } from "@/components/shared/progress-ring"
import {
  TopicStatePanel,
  type LatestTopicInfo,
} from "@/components/student/topic-state-panel"
import { cn } from "@/lib/utils"
import type { MilestoneStatus, ProjectStatus } from "@/types"

interface ProgressData {
  project: {
    id: string
    title: string
    description: string | null
    status: ProjectStatus
    progress: number
    startDate: string | null
    expectedEndDate: string | null
    supervisor: {
      id: string
      name: string
      email: string
      department: string | null
      supervisorProfile: { specialization: string | null } | null
    }
    milestones: {
      id: string
      name: string
      status: MilestoneStatus
      order: number
      weight: number
      dueDate: string | null
      completedDate: string | null
      description: string | null
    }[]
  } | null
  latestTopic: LatestTopicInfo | null
  hasProject: boolean
  totalMilestones: number
  completedMilestones: number
}

const milestoneDotStyle: Record<MilestoneStatus, string> = {
  NOT_STARTED: "bg-white border-slate-300",
  IN_PROGRESS: "bg-amber-100 border-amber-500",
  COMPLETED: "bg-emerald-100 border-emerald-500",
  OVERDUE: "bg-rose-100 border-rose-500",
}

const milestoneIconStyle: Record<MilestoneStatus, string> = {
  NOT_STARTED: "text-slate-300",
  IN_PROGRESS: "text-amber-600",
  COMPLETED: "text-emerald-600",
  OVERDUE: "text-rose-600",
}

const milestoneBadge: Record<MilestoneStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-500",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-rose-100 text-rose-700",
}

interface ProgressTip {
  title: string
  description: string
  cardClass: string
  iconClass: string
  textClass: string
}

function getProgressTip(progress: number): ProgressTip {
  if (progress < 25) {
    return {
      title: "Getting Started",
      description:
        "Focus on your proposal and literature review. Discuss your topic thoroughly with your supervisor and establish a clear research question.",
      cardClass: "border-amber-200 bg-amber-50/60",
      iconClass: "text-amber-500",
      textClass: "text-amber-700",
    }
  }
  if (progress < 50) {
    return {
      title: "Building Momentum",
      description:
        "Great progress! Focus on data collection and analysis. Stay consistent with regular submissions and address supervisor feedback promptly.",
      cardClass: "border-amber-200 bg-amber-50/60",
      iconClass: "text-amber-500",
      textClass: "text-amber-700",
    }
  }
  if (progress < 75) {
    return {
      title: "Almost There",
      description:
        "You're past the halfway mark! Focus on writing and refining your analysis. Keep your chapters organized and well-structured.",
      cardClass: "border-emerald-200 bg-emerald-50/60",
      iconClass: "text-emerald-500",
      textClass: "text-emerald-700",
    }
  }
  return {
    title: "Final Stretch",
    description:
      "Nearly done! Complete your final report, prepare for presentation, and address any remaining supervisor feedback. You're almost at the finish line.",
    cardClass: "border-emerald-200 bg-emerald-50/60",
    iconClass: "text-emerald-500",
    textClass: "text-emerald-700",
  }
}

export function ProgressView() {
  const { data, isLoading } = useQuery<ProgressData>({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/student")
      const json = await res.json()
      return json.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  if (!data?.hasProject || !data.project) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Progress</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data?.latestTopic
                ? "Your progress timeline will appear once your topic is approved."
                : "Submit a topic to start tracking your progress."}
            </p>
          </div>
        </motion.div>
        <TopicStatePanel topic={data?.latestTopic ?? null} context="progress" />
      </div>
    )
  }

  const p = data.project
  const tip = getProgressTip(p.progress)
  const milestones = [...p.milestones].sort((a, b) => a.order - b.order)
  const completedCount = milestones.filter(
    (m) => m.status === "COMPLETED",
  ).length
  const inProgressCount = milestones.filter(
    (m) => m.status === "IN_PROGRESS",
  ).length
  const overdueCount = milestones.filter(
    (m) => m.status === "OVERDUE",
  ).length

  // Days until expected end
  const daysLeft = p.expectedEndDate
    ? differenceInDays(new Date(p.expectedEndDate), new Date())
    : null

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Progress</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track your project milestones and overall completion
          </p>
        </div>
        <Link
          href="/student/project"
          className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 sm:self-auto"
        >
          View full project
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>

      {/* Large Progress Ring */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="overflow-hidden rounded-xl border-slate-200/60">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 h-1.5" />
          <CardContent className="flex flex-col items-center gap-6 p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-center">
              <ProgressRing
                percentage={p.progress}
                size={180}
                strokeWidth={14}
                label="Complete"
              />
              <p className="mt-4 text-lg font-semibold text-slate-800">
                {p.progress}% Complete
              </p>
              <p className="text-sm text-slate-500">
                {completedCount} of {milestones.length} milestones completed
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 md:max-w-md md:grid-cols-2">
              <StatBox
                icon={CheckCircle2}
                label="Completed"
                value={completedCount}
                tone="emerald"
              />
              <StatBox
                icon={Clock}
                label="In Progress"
                value={inProgressCount}
                tone="amber"
              />
              <StatBox
                icon={Circle}
                label="Not Started"
                value={
                  milestones.length -
                  completedCount -
                  inProgressCount -
                  overdueCount
                }
                tone="slate"
              />
              <StatBox
                icon={AlertCircle}
                label="Overdue"
                value={overdueCount}
                tone="rose"
              />
              {daysLeft !== null && (
                <div className="col-span-2 mt-1 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">
                      {daysLeft >= 0
                        ? "Days until expected end date"
                        : "Days past expected end date"}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-bold",
                        daysLeft < 0
                          ? "text-rose-600"
                          : daysLeft < 14
                            ? "text-amber-600"
                            : "text-slate-700",
                      )}
                    >
                      {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? "s" : ""}{" "}
                      {daysLeft >= 0 ? "remaining" : "overdue"}
                    </p>
                  </div>
                  {p.expectedEndDate && (
                    <span className="text-[10px] text-slate-400">
                      {format(new Date(p.expectedEndDate), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress Tips */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className={cn("rounded-xl border", tip.cardClass)}>
          <CardContent className="flex items-start gap-3 p-4">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60",
                tip.iconClass,
              )}
            >
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("text-sm font-semibold", tip.textClass)}>
                {tip.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {tip.description}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Milestone Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="rounded-xl border-slate-200/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-400" />
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Milestone Timeline
                </CardTitle>
              </div>
              <span className="text-xs text-slate-400">
                Weighted: {p.progress}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-slate-200" />

              <div className="space-y-5">
                {milestones.map((m) => {
                  const isCompleted = m.status === "COMPLETED"
                  return (
                    <div
                      key={m.id}
                      className="relative flex gap-4"
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          "relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                          milestoneDotStyle[m.status],
                        )}
                      >
                        {m.status === "COMPLETED" && (
                          <CheckCircle2
                            className={cn(
                              "h-4 w-4",
                              milestoneIconStyle[m.status],
                            )}
                          />
                        )}
                        {m.status === "IN_PROGRESS" && (
                          <Loader2
                            className={cn(
                              "h-4 w-4 animate-spin",
                              milestoneIconStyle[m.status],
                            )}
                          />
                        )}
                        {m.status === "OVERDUE" && (
                          <AlertCircle
                            className={cn(
                              "h-4 w-4",
                              milestoneIconStyle[m.status],
                            )}
                          />
                        )}
                        {m.status === "NOT_STARTED" && (
                          <div className="h-2 w-2 rounded-full bg-slate-300" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isCompleted
                                  ? "text-slate-500 line-through"
                                  : "text-slate-800",
                              )}
                            >
                              {m.name}
                            </p>
                            {m.description && (
                              <p className="mt-0.5 text-xs text-slate-400">
                                {m.description}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={cn(
                              "shrink-0 text-[10px]",
                              milestoneBadge[m.status],
                            )}
                          >
                            {m.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Flag className="h-3 w-3" />
                            Weight {m.weight}%
                          </span>
                          {m.dueDate && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due {format(new Date(m.dueDate), "MMM d, yyyy")}
                              {m.status !== "COMPLETED" && (
                                <span className="text-slate-400">
                                  {" "}
                                  (
                                  {formatDistanceToNow(new Date(m.dueDate), {
                                    addSuffix: true,
                                  })}
                                  )
                                </span>
                              )}
                            </span>
                          )}
                          {m.completedDate && (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed{" "}
                              {format(new Date(m.completedDate), "MMM d, yyyy")}
                            </span>
                          )}
                          {m.status === "OVERDUE" && (
                            <span className="font-medium text-rose-500">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-3"
      >
        <Link
          href="/student/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Upload Next Document
        </Link>
        <Link
          href="/student/feedback"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
        >
          <Clock className="h-3.5 w-3.5" />
          View Feedback
        </Link>
      </motion.div>
    </div>
  )
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2
  label: string
  value: number
  tone: "emerald" | "amber" | "slate" | "rose"
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
    amber: "border-amber-200 bg-amber-50/40 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50/40 text-rose-700",
  }
  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <span className="text-[10px] uppercase tracking-wide opacity-80">
          {label}
        </span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}
