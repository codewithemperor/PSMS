"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { format } from "date-fns"
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  FileText,
  Mail,
  MessageCircle,
  Briefcase,
  FilePlus,
  RefreshCw,
  GraduationCap,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/**
 * Shared "topic state" panel rendered on the student Dashboard, My Project
 * and My Progress pages when the student does NOT yet have an active Project
 * but DOES have a Topic in one of: PENDING / REJECTED / REVISION_REQUIRED
 * (or APPROVED-but-project-not-yet-created).
 *
 * Replaces the old generic "No project yet" empty state with a state-aware
 * view that tells the student exactly where they are in the pipeline and
 * shows the supervisor that was assigned to them.
 */
export interface LatestTopicInfo {
  id: string
  title: string
  description?: string | null
  status: string
  submittedAt: string
  reviewedAt?: string | null
  reviewerComment?: string | null
  supervisor: {
    id: string
    name: string
    email: string
    department?: string | null
    supervisorProfile?: { specialization?: string | null } | null
  }
}

interface TopicStatePanelProps {
  topic: LatestTopicInfo | null
  /** Where this panel is rendered — tweaks the CTA copy. */
  context: "dashboard" | "project" | "progress"
}

export function TopicStatePanel({ topic, context }: TopicStatePanelProps) {
  // ── Case A: truly no topic at all → prompt to submit one ──
  if (!topic) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden rounded-xl border-slate-200/60">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-100">
              <FilePlus className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800">
              No topic submitted yet
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              You haven&apos;t submitted a project topic. Propose one and a
              supervisor will be auto-assigned to review it.
            </p>
            <Button
              asChild
              className="mt-5 rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/student/topic">
                <FilePlus className="mr-1.5 h-4 w-4" />
                Submit a Topic
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const t = topic
  const supervisor = t.supervisor

  // ── Supervisor info chip (shared across states) ──
  const SupervisorChip = (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Assigned Supervisor
          </p>
          <p className="truncate text-sm font-bold text-slate-800">
            {supervisor.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {supervisor.email}
            </span>
            {supervisor.department && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {supervisor.department}
              </span>
            )}
            {supervisor.supervisorProfile?.specialization && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {supervisor.supervisorProfile.specialization}
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="shrink-0 rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50"
      >
        <Link href="/student/messages">
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
          Contact Supervisor
        </Link>
      </Button>
    </div>
  )

  // ── Case B: PENDING — under review ──
  if (t.status === "PENDING") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden rounded-xl border-amber-200">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 ring-1 ring-inset ring-amber-200">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-800">
                Topic Submitted — Under Review
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Your topic has been submitted and is awaiting your
                supervisor&apos;s decision. You&apos;ll be notified once it is
                reviewed.
              </p>
              <Badge className="mt-3 bg-amber-100 text-amber-700">
                <Clock className="mr-1 h-3 w-3" />
                Pending Review
              </Badge>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Submitted Topic
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {t.title}
              </p>
              {t.description && (
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-500">
                  {t.description}
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-400">
                Submitted {format(new Date(t.submittedAt), "MMM d, yyyy")}
              </p>
            </div>

            {SupervisorChip}

            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                You cannot submit a new topic or upload documents while this
                one is pending review. A student may only have one active
                project at a time.
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── Case C: APPROVED but project not yet created (rare edge) ──
  if (t.status === "APPROVED") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden rounded-xl border-emerald-200">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-inset ring-emerald-200">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-800">
                Topic Approved — Project Setup in Progress
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Your topic has been approved. Your project workspace is being
                set up — your supervisor will finalise milestones shortly.
              </p>
              <Badge className="mt-3 bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Approved
              </Badge>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Approved Topic
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {t.title}
              </p>
              {t.description && (
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-500">
                  {t.description}
                </p>
              )}
              {t.reviewedAt && (
                <p className="mt-2 text-[11px] text-emerald-600">
                  Approved {format(new Date(t.reviewedAt), "MMM d, yyyy")}
                </p>
              )}
            </div>

            {SupervisorChip}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── Case D: REJECTED ──
  if (t.status === "REJECTED") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden rounded-xl border-rose-200">
          <div className="h-1.5 bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400" />
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 ring-1 ring-inset ring-rose-200">
                <AlertCircle className="h-8 w-8 text-rose-600" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-800">
                Topic Rejected
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Your supervisor has rejected your topic. Review their comment
                and submit a revised proposal.
              </p>
              <Badge className="mt-3 bg-rose-100 text-rose-700">
                <AlertCircle className="mr-1 h-3 w-3" />
                Rejected
              </Badge>
            </div>

            {t.reviewerComment && (
              <div className="mt-5 rounded-lg border-l-[3px] border-rose-300 bg-rose-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
                  Reviewer&apos;s Comment
                </p>
                <p className="mt-1 text-sm italic text-slate-700">
                  &ldquo;{t.reviewerComment}&rdquo;
                </p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Rejected Topic
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {t.title}
              </p>
              {t.reviewedAt && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Reviewed {format(new Date(t.reviewedAt), "MMM d, yyyy")}
                </p>
              )}
            </div>

            {SupervisorChip}

            <Button
              asChild
              className="mt-5 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/student/topic">
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Submit a New Topic
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── Case E: REVISION_REQUIRED ──
  if (t.status === "REVISION_REQUIRED") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden rounded-xl border-orange-200">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400" />
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 ring-1 ring-inset ring-orange-200">
                <Info className="h-8 w-8 text-orange-600" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-800">
                Revision Required
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Your topic needs adjustments before it can be approved. Review
                the feedback and submit a revised version.
              </p>
              <Badge className="mt-3 bg-orange-100 text-orange-700">
                <Info className="mr-1 h-3 w-3" />
                Revision Required
              </Badge>
            </div>

            {t.reviewerComment && (
              <div className="mt-5 rounded-lg border-l-[3px] border-orange-300 bg-orange-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">
                  Reviewer&apos;s Comment
                </p>
                <p className="mt-1 text-sm italic text-slate-700">
                  &ldquo;{t.reviewerComment}&rdquo;
                </p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Previous Topic
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {t.title}
              </p>
            </div>

            {SupervisorChip}

            <Button
              asChild
              className="mt-5 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/student/topic">
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Submit Revised Topic
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Fallback (unknown status) — treat like "no topic"
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-xl border-slate-200/60">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <FilePlus className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            {context === "dashboard"
              ? "Start your project journey"
              : "No active project"}
          </p>
          <Button
            asChild
            className="mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-700"
          >
            <Link href="/student/topic">Submit a Topic</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
