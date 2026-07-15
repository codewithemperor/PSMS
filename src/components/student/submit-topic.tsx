"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  FilePlus,
  Loader2,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
  Lightbulb,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { TopicStatus } from "@/types"

interface MyTopic {
  id: string
  title: string
  description?: string
  status: TopicStatus
  submittedAt: string
  reviewerComment: string | null
}

const statusBadge: Record<TopicStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  REVISION_REQUIRED: "bg-orange-100 text-orange-700",
}

const statusIcon: Record<TopicStatus, typeof Clock> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: AlertCircle,
  REVISION_REQUIRED: Info,
}

export function SubmitTopic() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [hasPrefilled, setHasPrefilled] = useState(false)

  // Fetch my existing topics
  const { data: myTopics, isLoading } = useQuery<MyTopic[]>({
    queryKey: ["my-topics"],
    queryFn: async () => {
      const res = await fetch("/api/topics?limit=20")
      const json = await res.json()
      return json.data
    },
  })

  const topics = myTopics ?? []
  // Latest topic determines the "current state"
  const latestTopic = topics[0] ?? null

  // Form-open rule (one project per student):
  //   - No topic → open (new submission)
  //   - REJECTED / REVISION_REQUIRED → open (revise & resubmit)
  //   - PENDING → CLOSED, locked (wait for review — no override)
  //   - APPROVED → CLOSED, locked (project already exists — no override)
  // The previous "Show submission form anyway" override was removed because
  // a student must not be able to submit a new topic while one is pending
  // or approved.
  const formOpen =
    !latestTopic ||
    latestTopic.status === "REJECTED" ||
    latestTopic.status === "REVISION_REQUIRED"
  const isLocked =
    !!latestTopic &&
    (latestTopic.status === "PENDING" ||
      latestTopic.status === "APPROVED")

  // Pre-fill the form ONCE when we have a revision-topic loaded.
  // (We can't use useEffect with setState due to lint rules; doing it inline
  // during render with a guard flag is safe because we only set state when
  // the data first arrives.)
  if (
    !hasPrefilled &&
    latestTopic &&
    (latestTopic.status === "REJECTED" ||
      latestTopic.status === "REVISION_REQUIRED")
  ) {
    if (latestTopic.title && title === "") setTitle(latestTopic.title)
    if (latestTopic.description && description === "")
      setDescription(latestTopic.description)
    setHasPrefilled(true)
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Submission failed")
      return json
    },
    onSuccess: (data) => {
      toast.success(
        `Topic submitted. Assigned to ${data.data?.supervisorName ?? "your supervisor"} for review.`,
      )
      setTitle("")
      setDescription("")
      setHasPrefilled(false)
      queryClient.invalidateQueries({ queryKey: ["my-topics"] })
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitMutation.mutate()
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
  }

  const isRevision =
    latestTopic?.status === "REJECTED" ||
    latestTopic?.status === "REVISION_REQUIRED"

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Submit Topic</h1>
          <p className="mt-1 text-sm text-slate-500">
            Propose a project topic for approval. A supervisor will be
            auto-assigned to you based on availability.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* LEFT: Status card + form */}
        <div className="space-y-4 lg:col-span-3">
          {/* Status-based rendering for the LATEST topic */}

          {/* No topic yet — pure new submission */}
          <AnimatePresence mode="wait">
            {!latestTopic && (
              <motion.div
                key="no-topic"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="rounded-xl border-slate-200/60 bg-slate-50/40">
                  <CardContent className="flex items-start gap-3 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                      <Lightbulb className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        No topic submitted yet
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Use the form below to propose your project topic. Your
                        supervisor will review and either approve, reject, or
                        request revisions.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* PENDING */}
            {latestTopic?.status === "PENDING" && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="rounded-xl border-amber-200 bg-amber-50/40">
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                      <Clock className="h-7 w-7 text-amber-500" />
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-800">
                      Topic Under Review
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Your topic is being reviewed by your supervisor. You will
                      be notified when there&apos;s a decision.
                    </p>
                    <div className="mt-4 max-w-md rounded-lg bg-white p-4 text-left shadow-sm">
                      <p className="font-medium text-slate-800">
                        {latestTopic.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Submitted{" "}
                        {format(
                          new Date(latestTopic.submittedAt),
                          "MMM d, yyyy",
                        )}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-100/50 px-3 py-2 text-xs text-amber-800">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        You cannot submit a new topic while this one is pending
                        review. A student may only have one active project at a
                        time.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* APPROVED */}
            {latestTopic?.status === "APPROVED" && (
              <motion.div
                key="approved"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="rounded-xl border-emerald-200 bg-emerald-50/40">
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-800">
                      Topic Approved!
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Your project has been set up. You can now upload
                      documents and track your progress.
                    </p>
                    <div className="mt-4 max-w-md rounded-lg bg-white p-4 text-left shadow-sm">
                      <p className="font-medium text-slate-800">
                        {latestTopic.title}
                      </p>
                      <p className="mt-1 text-xs text-emerald-600">
                        Approved{" "}
                        {format(
                          new Date(latestTopic.submittedAt),
                          "MMM d, yyyy",
                        )}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-100/50 px-3 py-2 text-xs text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Your project is active. You cannot submit a new topic
                        while this project is in progress — a student may only
                        have one active project at a time.
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                      >
                        <a href="/student/upload">
                          <FilePlus className="mr-1.5 h-3.5 w-3.5" />
                          Upload a Document
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                      >
                        <a href="/student/project">
                          View My Project
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* REJECTED */}
            {latestTopic?.status === "REJECTED" && (
              <motion.div
                key="rejected"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="rounded-xl border-rose-200 bg-rose-50/40">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-base font-semibold text-rose-800">
                          Topic Rejected
                        </h2>
                        <p className="mt-1 text-xs text-rose-700">
                          Your supervisor has rejected this topic. Please review
                          their comment and submit a new proposal.
                        </p>
                        {latestTopic.reviewerComment && (
                          <div className="mt-3 rounded-lg border-l-2 border-rose-300 bg-white p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
                              Reviewer&apos;s comment
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              &ldquo;{latestTopic.reviewerComment}&rdquo;
                            </p>
                          </div>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          Previous title:{" "}
                          <span className="italic">{latestTopic.title}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* REVISION_REQUIRED */}
            {latestTopic?.status === "REVISION_REQUIRED" && (
              <motion.div
                key="revision"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="rounded-xl border-orange-200 bg-orange-50/40">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                        <Info className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-base font-semibold text-orange-800">
                          Revision Required
                        </h2>
                        <p className="mt-1 text-xs text-orange-700">
                          Your topic needs some adjustments before approval.
                          Review the feedback below and submit a revised
                          version.
                        </p>
                        {latestTopic.reviewerComment && (
                          <div className="mt-3 rounded-lg border-l-2 border-orange-300 bg-white p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">
                              Reviewer&apos;s comment
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              &ldquo;{latestTopic.reviewerComment}&rdquo;
                            </p>
                          </div>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          Your previous title has been pre-filled in the form
                          below.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* The submission form is only shown when the student is allowed
              to submit (no topic, or latest topic is REJECTED /
              REVISION_REQUIRED). When the latest topic is PENDING or
              APPROVED, the form is intentionally NOT rendered and there is
              no override — a student may only have one active project. */}

          {/* The form (for new submission or revision) */}
          {formOpen && !isLocked && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="rounded-xl border-slate-200/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    {isRevision
                      ? "Submit Revised Topic"
                      : "New Topic Proposal"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-sm text-slate-700">
                        Topic Title <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        placeholder="e.g. A Web-Based Library Management System"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        minLength={5}
                        maxLength={200}
                        className="rounded-lg"
                      />
                      <p className="text-[11px] text-slate-400">
                        {title.length}/200 characters · min 5
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="description"
                        className="text-sm text-slate-700"
                      >
                        Description <span className="text-rose-500">*</span>
                      </Label>
                      <Textarea
                        id="description"
                        placeholder="Describe the problem you want to solve, the scope of the project, the technologies you plan to use, and the expected outcomes..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        minLength={20}
                        rows={6}
                        className="rounded-lg"
                      />
                      <p className="text-[11px] text-slate-400">
                        {description.length} characters · min 20
                      </p>
                    </div>

                    {/* Tips */}
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <Lightbulb className="h-4 w-4" />
                        Tips for a good topic proposal
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-emerald-700">
                        <li>Be specific and focused on a clear research problem</li>
                        <li>Ensure it relates to your field of study</li>
                        <li>Consider available resources and data accessibility</li>
                        <li>Discuss with your supervisor before submitting</li>
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={
                          submitMutation.isPending ||
                          title.trim().length < 5 ||
                          description.trim().length < 20
                        }
                        className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                      >
                        {submitMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-4 w-4" />
                        )}
                        {isRevision ? "Submit Revised Topic" : "Submit for Approval"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg"
                        onClick={resetForm}
                      >
                        Clear Form
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* RIGHT: Topic history */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  My Topic Submissions ({topics.length})
                </CardTitle>
                {latestTopic && (
                  <Badge className={`text-[10px] ${statusBadge[latestTopic.status]}`}>
                    Latest: {latestTopic.status.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : topics.length === 0 ? (
                <div className="py-8 text-center">
                  <FilePlus className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-400">
                    No topics submitted yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Your submission history will appear here
                  </p>
                </div>
              ) : (
                <div className="max-h-[40rem] space-y-3 overflow-y-auto pr-1">
                  {topics.map((t, idx) => {
                    const Icon = statusIcon[t.status]
                    const isLatest = idx === 0
                    return (
                      <div
                        key={t.id}
                        className={`rounded-lg border p-3 ${
                          isLatest
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-slate-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-700">
                            {t.title}
                          </p>
                          <Badge
                            className={`shrink-0 text-[10px] ${statusBadge[t.status]}`}
                          >
                            <Icon className="mr-0.5 h-2.5 w-2.5" />
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Submitted{" "}
                          {format(new Date(t.submittedAt), "MMM d, yyyy")}
                          {isLatest && (
                            <span className="ml-1 font-medium text-emerald-600">
                              · latest
                            </span>
                          )}
                        </p>
                        {t.reviewerComment && (
                          <div className="mt-2 rounded border-l-2 border-slate-300 bg-slate-50 p-2">
                            <p className="text-[10px] font-medium text-slate-500">
                              Reviewer&apos;s comment:
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {t.reviewerComment}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
