"use client"

import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  FileText,
  Loader2,
  Send,
  MessageCircle,
  Download,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import type { DocumentType } from "@/types"

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface StudentOption {
  id: string
  name: string
  matricNo: string | null
}

interface DocFeedbackItem {
  id: string
  content: string
  status: string
  createdAt: string
  author: { id: string; name: string }
}

interface DocumentRow {
  id: string
  title: string
  description: string | null
  fileName: string
  fileSize: number
  fileType: string
  documentType: DocumentType
  version: number
  isFinal: boolean
  createdAt: string
  uploadedBy: {
    id: string
    name: string
    email: string
    matricNo: string | null
  }
  project: {
    id: string
    title: string
    student: { id: string; name: string }
  }
  feedback: DocFeedbackItem[]
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDocType(type: DocumentType): string {
  switch (type) {
    case "LITERATURE_REVIEW":
      return "Literature Review"
    case "DATA_ANALYSIS":
      return "Data Analysis"
    case "FINAL_REPORT":
      return "Final Report"
    default:
      return type
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
  }
}

const DOC_TYPE_OPTIONS: { value: DocumentType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "LITERATURE_REVIEW", label: "Literature Review" },
  { value: "METHODOLOGY", label: "Methodology" },
  { value: "DATA_ANALYSIS", label: "Data Analysis" },
  { value: "DRAFT", label: "Draft" },
  { value: "FINAL_REPORT", label: "Final Report" },
  { value: "OTHER", label: "Other" },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentReview() {
  const queryClient = useQueryClient()

  const [studentFilter, setStudentFilter] = useState<string>("ALL")
  const [docTypeFilter, setDocTypeFilter] = useState<DocumentType | "ALL">(
    "ALL",
  )
  const [unreviewedOnly, setUnreviewedOnly] = useState(false)

  const [feedbackTarget, setFeedbackTarget] = useState<DocumentRow | null>(null)
  const [feedbackContent, setFeedbackContent] = useState("")

  // ---- Fetch assigned students (for the filter dropdown) ---------------
  const { data: studentsData } = useQuery<StudentOption[]>({
    queryKey: ["supervisor-students"],
    queryFn: async () => {
      const res = await fetch(
        "/api/supervisor/students",
      )
      const json = await res.json()
      if (!res.ok || !json.success) return []
      return (json.data ?? []).map((s: { id: string; name: string; matricNo: string | null }) => ({
        id: s.id,
        name: s.name,
        matricNo: s.matricNo,
      })) as StudentOption[]
    },
  })
  const students = studentsData ?? []

  // ---- Fetch documents (role-filtered for SUPERVISOR on backend) ------
  const { data: docsData, isLoading } = useQuery<DocumentRow[]>({
    queryKey: ["supervisor-documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load documents")
      }
      return json.data as DocumentRow[]
    },
  })

  const allDocs = docsData ?? []

  // ---- Client-side filtering ------------------------------------------
  const filteredDocs = useMemo(() => {
    return allDocs.filter((d) => {
      if (
        studentFilter !== "ALL" &&
        d.project.student.id !== studentFilter
      ) {
        return false
      }
      if (
        docTypeFilter !== "ALL" &&
        d.documentType !== docTypeFilter
      ) {
        return false
      }
      if (unreviewedOnly && d.feedback.length > 0) {
        return false
      }
      return true
    })
  }, [allDocs, studentFilter, docTypeFilter, unreviewedOnly])

  // ---- Submit feedback mutation ---------------------------------------
  const feedbackMutation = useMutation({
    mutationFn: async ({
      docId,
      content,
    }: {
      docId: string
      content: string
    }) => {
      const res = await fetch(
        `/api/documents/${docId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to submit feedback")
      }
      return json
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Feedback submitted. Student notified.")
      setFeedbackTarget(null)
      setFeedbackContent("")
      queryClient.invalidateQueries({ queryKey: ["supervisor-documents"] })
      queryClient.invalidateQueries({ queryKey: ["supervisor-dashboard"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const downloadDoc = (docId: string) => {
    window.open(
      `/api/documents/${docId}/download`,
      "_blank",
    )
  }

  // ---------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">
          Documents to Review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review documents uploaded by your students and provide feedback.
        </p>
      </motion.div>

      {/* Filter bar */}
      <Card className="rounded-xl border-slate-200/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={studentFilter}
              onValueChange={setStudentFilter}
            >
              <SelectTrigger className="w-full rounded-lg sm:w-56">
                <SelectValue placeholder="All Students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Students</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.matricNo ? ` · ${s.matricNo}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={docTypeFilter}
              onValueChange={(v) =>
                setDocTypeFilter(v as DocumentType | "ALL")
              }
            >
              <SelectTrigger className="w-full rounded-lg sm:w-48">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 sm:ml-auto">
              <Switch
                id="unreviewed"
                checked={unreviewedOnly}
                onCheckedChange={setUnreviewedOnly}
              />
              <Label htmlFor="unreviewed" className="text-sm text-slate-600">
                Unreviewed only
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Documents checklist — shows which expected document types
          each student has submitted vs. still missing. Helps the supervisor
          see at a glance what's outstanding. */}
      <RequiredDocumentsCard
        docs={allDocs}
        students={students}
        studentFilter={studentFilter}
      />

      {/* Documents — 3 cards per row on desktop, 2 on tablet, 1 on mobile.
          Each card is compact (icon + title + meta + status badge, optional
          last-feedback preview, and a primary "Open Review" CTA with
          secondary Download + Quick Feedback actions). */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents to review"
          description="When your students upload documents (proposals, drafts, reports), they will appear here for your review."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocs.map((doc, idx) => {
            const hasFeedback = doc.feedback.length > 0
            const lastFeedback = doc.feedback[0] ?? null
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                className="h-full"
              >
                <Card className="flex h-full flex-col rounded-xl border-slate-200/60 transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    {/* Header: icon + title + status badge */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                        <FileText className="size-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800" title={doc.title}>
                          {doc.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500" title={doc.project.student.name}>
                          {doc.project.student.name} · v{doc.version} · {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                      {hasFeedback ? (
                        <Badge className="shrink-0 bg-amber-100 text-amber-700">
                          Awaiting
                        </Badge>
                      ) : (
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-700">
                          New
                        </Badge>
                      )}
                    </div>

                    {/* Meta row: doc type + uploaded time */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {formatDocType(doc.documentType)}
                      </Badge>
                      <span>·</span>
                      <span>
                        Uploaded{" "}
                        {formatDistanceToNow(new Date(doc.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {/* Last feedback preview (if any) */}
                    {lastFeedback && (
                      <div className="rounded-lg border-l-[3px] border-slate-300 bg-slate-50 p-2.5">
                        <p className="text-[11px] font-medium text-slate-500">
                          Your last feedback:
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                          {lastFeedback.content}
                        </p>
                      </div>
                    )}

                    {/* Actions — pinned to bottom of card */}
                    <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-3">
                      <Button
                        asChild
                        size="sm"
                        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Link href={`/supervisor/document-review/${doc.id}`}>
                          <ExternalLink className="mr-1.5 size-4" />
                          Open Review Thread
                          {doc.feedback.length > 0 && (
                            <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
                              {doc.feedback.length}
                            </span>
                          )}
                        </Link>
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-lg"
                          onClick={() => downloadDoc(doc.id)}
                        >
                          <Download className="mr-1 size-4" /> Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-lg"
                          onClick={() => {
                            setFeedbackTarget(doc)
                            setFeedbackContent("")
                          }}
                        >
                          <MessageCircle className="mr-1 size-4" /> Feedback
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Feedback dialog */}
      <Dialog
        open={!!feedbackTarget}
        onOpenChange={(open) => {
          if (!open) {
            setFeedbackTarget(null)
            setFeedbackContent("")
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              Feedback on &ldquo;{feedbackTarget?.title ?? ""}&rdquo;
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Your feedback will be sent to{" "}
              {feedbackTarget?.project.student.name ?? "the student"} and they
              will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dr-feedback" className="text-sm text-slate-700">
              Your feedback <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="dr-feedback"
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              placeholder="e.g. The methodology section is clear. Please add more detail on the data collection process..."
              rows={6}
              className="rounded-lg"
            />
            <p className="text-xs text-slate-400">
              {feedbackContent.trim().length}/10 minimum characters
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFeedbackTarget(null)
                setFeedbackContent("")
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              disabled={
                feedbackContent.trim().length < 10 ||
                feedbackMutation.isPending ||
                !feedbackTarget
              }
              onClick={() => {
                if (feedbackTarget) {
                  feedbackMutation.mutate({
                    docId: feedbackTarget.id,
                    content: feedbackContent.trim(),
                  })
                }
              }}
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {feedbackMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              <Send className="mr-1.5 h-4 w-4" />
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Required Documents checklist
// Shows, per student, which expected document types have been submitted
// (green check) vs. still missing (hollow circle). Gives the supervisor an
// at-a-glance view of what each student still owes.
// ---------------------------------------------------------------------------

const REQUIRED_DOC_TYPES: { type: DocumentType; label: string }[] = [
  { type: "PROPOSAL", label: "Proposal" },
  { type: "LITERATURE_REVIEW", label: "Literature Review" },
  { type: "METHODOLOGY", label: "Methodology" },
  { type: "DATA_ANALYSIS", label: "Data Analysis" },
  { type: "FINAL_REPORT", label: "Final Report" },
]

function RequiredDocumentsCard({
  docs,
  students,
  studentFilter,
}: {
  docs: DocumentRow[]
  students: StudentOption[]
  studentFilter: string
}) {
  // If a specific student is selected, show only their checklist.
  // Otherwise show every assigned student (compact rows).
  const shownStudents =
    studentFilter === "ALL"
      ? students
      : students.filter((s) => s.id === studentFilter)

  if (shownStudents.length === 0) {
    return null
  }

  // Build a map: studentId → Set<documentType>
  const docsByStudent = new Map<string, Set<DocumentType>>()
  for (const d of docs) {
    const sid = d.project.student.id
    if (!docsByStudent.has(sid)) docsByStudent.set(sid, new Set())
    docsByStudent.get(sid)!.add(d.documentType)
  }

  return (
    <Card className="rounded-xl border-slate-200/60">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Required Documents
          </h3>
          <span className="text-xs text-slate-400">
            · {shownStudents.length} student{shownStudents.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-3">
          {shownStudents.map((s) => {
            const submitted = docsByStudent.get(s.id) ?? new Set<DocumentType>()
            const submittedCount = REQUIRED_DOC_TYPES.filter((r) =>
              submitted.has(r.type),
            ).length
            const total = REQUIRED_DOC_TYPES.length
            const complete = submittedCount === total

            return (
              <div
                key={s.id}
                className="rounded-lg border border-slate-100 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {s.name}
                      {s.matricNo ? (
                        <span className="ml-1.5 text-xs text-slate-400">
                          · {s.matricNo}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Badge
                    className={`text-[10px] ${
                      complete
                        ? "bg-emerald-100 text-emerald-700"
                        : submittedCount > 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {submittedCount}/{total}
                  </Badge>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {REQUIRED_DOC_TYPES.map((r) => {
                    const has = submitted.has(r.type)
                    return (
                      <span
                        key={r.type}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                          has
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-50 text-slate-400"
                        }`}
                        title={has ? `${r.label} submitted` : `${r.label} not yet submitted`}
                      >
                        {has ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {r.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

