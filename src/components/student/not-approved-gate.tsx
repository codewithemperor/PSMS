"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { format } from "date-fns"
import {
  FileX2,
  MessageCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
  Mail,
  Briefcase,
  GraduationCap,
  FileText,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { LatestTopicInfo } from "@/components/student/topic-state-panel"

/**
 * Gate panel shown on the Upload Document and (optionally) Progress pages
 * when the student is NOT allowed to upload documents yet.
 *
 * Reasons:
 *  - No topic submitted at all
 *  - Topic submitted but still PENDING / REVISION_REQUIRED / REJECTED
 *  - Topic APPROVED but project not yet created
 *  - Project exists but status is NOT_STARTED
 *
 * In all of these cases the upload UI is hidden and the student sees a clear
 * message plus a "Contact your Supervisor" button that routes to the chat
 * (messages) screen.
 */
interface NotApprovedGateProps {
  topic: LatestTopicInfo | null
  /** When the project exists but is NOT_STARTED, pass its title. */
  projectTitle?: string | null
  /** Sub-reason when project exists but status disallows upload. */
  reason?:
    | "no_topic"
    | "topic_pending"
    | "topic_rejected"
    | "topic_revision"
    | "topic_approved_pending_project"
    | "project_not_started"
}

export function NotApprovedGate({
  topic,
  projectTitle,
  reason = topic ? inferReason(topic) : "no_topic",
}: NotApprovedGateProps) {
  const supervisor = topic?.supervisor

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="overflow-hidden rounded-xl border-slate-200/60">
        <div className="h-1.5 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300" />
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
            <FileX2 className="h-8 w-8 text-slate-500" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">
            {titleFor(reason)}
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {descriptionFor(reason, topic, projectTitle)}
          </p>

          {topic && (
            <div className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Your Topic
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {topic.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge className={badgeClassFor(reason)}>
                  {badgeIconFor(reason)}
                  {badgeLabelFor(reason)}
                </Badge>
                <span className="text-[11px] text-slate-400">
                  Submitted {format(new Date(topic.submittedAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          )}

          {/* Supervisor chip + contact CTA */}
          {supervisor ? (
            <div className="mt-5 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Your Supervisor
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
                    </div>
                  </div>
                </div>
              </div>
              <Button
                asChild
                className="mt-4 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700"
              >
                <Link href="/student/messages">
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Contact Your Supervisor
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              asChild
              className="mt-5 rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/student/topic">
                <FileText className="mr-1.5 h-4 w-4" />
                Submit a Topic First
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function inferReason(t: LatestTopicInfo): Exclude<NotApprovedGateProps["reason"], undefined> {
  switch (t.status) {
    case "PENDING":
      return "topic_pending"
    case "REJECTED":
      return "topic_rejected"
    case "REVISION_REQUIRED":
      return "topic_revision"
    case "APPROVED":
      return "topic_approved_pending_project"
    default:
      return "topic_pending"
  }
}

function titleFor(reason: string): string {
  switch (reason) {
    case "no_topic":
      return "Submit a topic first"
    case "topic_pending":
      return "Topic not approved yet"
    case "topic_rejected":
      return "Topic was rejected"
    case "topic_revision":
      return "Topic needs revision"
    case "topic_approved_pending_project":
      return "Project is being set up"
    case "project_not_started":
      return "Project not yet started"
    default:
      return "Uploads unavailable"
  }
}

function descriptionFor(
  reason: string,
  topic: LatestTopicInfo | null,
  projectTitle?: string | null,
): string {
  switch (reason) {
    case "no_topic":
      return "You need to submit a project topic and have it approved by your supervisor before you can upload documents."
    case "topic_pending":
      return "Your topic is still under review. Once your supervisor approves it, you'll be able to upload documents here."
    case "topic_rejected":
      return "Your topic was rejected. Please review your supervisor's comment on the Submit Topic page and submit a new proposal."
    case "topic_revision":
      return "Your supervisor has requested revisions to your topic. Address the feedback and resubmit before uploading documents."
    case "topic_approved_pending_project":
      return "Your topic was approved and your project workspace is being created. Check back shortly, or contact your supervisor if it's taking too long."
    case "project_not_started":
      return projectTitle
        ? `Your project “${projectTitle}” hasn't been started yet. Contact your supervisor to begin.`
        : "Your project hasn't been started yet. Contact your supervisor to begin."
    default:
      return "Document uploads are not available right now."
  }
}

function badgeClassFor(reason: string): string {
  switch (reason) {
    case "topic_pending":
    case "topic_approved_pending_project":
    case "project_not_started":
      return "bg-amber-100 text-amber-700"
    case "topic_rejected":
      return "bg-rose-100 text-rose-700"
    case "topic_revision":
      return "bg-orange-100 text-orange-700"
    default:
      return "bg-slate-100 text-slate-600"
  }
}

function badgeLabelFor(reason: string): string {
  switch (reason) {
    case "topic_pending":
      return "Pending Review"
    case "topic_rejected":
      return "Rejected"
    case "topic_revision":
      return "Revision Required"
    case "topic_approved_pending_project":
      return "Approved — setup pending"
    case "project_not_started":
      return "Not Started"
    default:
      return "Pending"
  }
}

function badgeIconFor(reason: string) {
  const cls = "mr-1 h-3 w-3"
  switch (reason) {
    case "topic_pending":
    case "topic_approved_pending_project":
    case "project_not_started":
      return <Clock className={cls} />
    case "topic_rejected":
      return <AlertCircle className={cls} />
    case "topic_revision":
      return <Info className={cls} />
    default:
      return <CheckCircle2 className={cls} />
  }
}
