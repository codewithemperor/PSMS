"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Upload,
  FileText,
  Loader2,
  Download,
  FileCheck,
  Trash2,
  CheckCircle2,
  Info,
  AlertCircle,
  Flag,
  MessageCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FileUploader } from "@/components/shared/file-uploader"
import { EmptyState } from "@/components/shared/empty-state"
import { NotApprovedGate } from "@/components/student/not-approved-gate"
import type { LatestTopicInfo } from "@/components/student/topic-state-panel"
import type { DocumentType } from "@/types"

interface MyDoc {
  id: string
  title: string
  fileName: string
  fileSize: number
  fileType: string
  documentType: DocumentType
  version: number
  isFinal: boolean
  createdAt: string
  uploadedBy: { id: string; name: string }
  project: { id: string; title: string; student: { id: string; name: string } }
  feedback: { id: string; status: string }[]
}

interface VersionsData {
  projectId: string
  projectTitle: string
  counts: Record<string, number>
  nextVersionByType: Record<string, number>
}

interface Milestone {
  id: string
  name: string
  status: string
}

interface DashboardProjectInfo {
  id: string
  title: string
  status: string
}
interface DashboardSnapshot {
  hasProject: boolean
  project: DashboardProjectInfo | null
  latestTopic: LatestTopicInfo | null
}

// Maps each document type to the milestone/phase it belongs to. When that
// milestone is COMPLETED, the student can no longer upload documents of
// that type (the phase is closed). Types without a mapping (DRAFT,
// METHODOLOGY, OTHER) are always allowed.
const DOC_TYPE_TO_MILESTONE: Partial<Record<DocumentType, string[]>> = {
  PROPOSAL: ["Proposal Submission", "Topic Approval"],
  LITERATURE_REVIEW: ["Literature Review"],
  DATA_ANALYSIS: ["Data Collection & Analysis", "Data Collection and Analysis"],
  FINAL_REPORT: ["Final Report & Submission", "Final Report and Submission", "Final Report"],
}

function isDocTypeLocked(
  docType: DocumentType,
  milestones: Milestone[],
): boolean {
  const names = DOC_TYPE_TO_MILESTONE[docType]
  if (!names) return false
  return milestones.some(
    (m) =>
      m.status === "COMPLETED" &&
      names.some(
        (n) => n.toLowerCase() === m.name.trim().toLowerCase(),
      ),
  )
}

const ALL_DOC_TYPE_OPTIONS: {
  value: DocumentType
  label: string
  hint: string
}[] = [
  { value: "PROPOSAL", label: "Proposal", hint: "Project proposal" },
  { value: "DRAFT", label: "Draft Chapter", hint: "Working draft" },
  { value: "LITERATURE_REVIEW", label: "Literature Review", hint: "Lit review chapter" },
  { value: "METHODOLOGY", label: "Methodology", hint: "Research methodology" },
  { value: "DATA_ANALYSIS", label: "Data Analysis", hint: "Analysis & findings" },
  { value: "FINAL_REPORT", label: "Final Report", hint: "Complete final report" },
  { value: "OTHER", label: "Other", hint: "Appendices, misc." },
]

const docTypeBadge: Record<DocumentType, string> = {
  PROPOSAL: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-slate-100 text-slate-600",
  LITERATURE_REVIEW: "bg-teal-50 text-teal-700",
  METHODOLOGY: "bg-amber-50 text-amber-700",
  DATA_ANALYSIS: "bg-orange-50 text-orange-700",
  FINAL_REPORT: "bg-rose-50 text-rose-700",
  OTHER: "bg-slate-50 text-slate-500",
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadDocument() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [docType, setDocType] = useState<DocumentType>("DRAFT")
  const [isFinal, setIsFinal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MyDoc | null>(null)

  // Fetch my documents
  const { data: docs, isLoading } = useQuery<MyDoc[]>({
    queryKey: ["my-documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      const json = await res.json()
      return json.data
    },
  })

  // Fetch version counts (for the version warning)
  const { data: versionsData } = useQuery<VersionsData>({
    queryKey: ["document-versions"],
    queryFn: async () => {
      const res = await fetch("/api/documents/versions")
      const json = await res.json()
      return json.data
    },
  })

  // Fetch the project's milestones so we can hide document types whose
  // milestone/phase has already been marked COMPLETED. Also surfaces the
  // project status + latestTopic so we can gate the whole upload UI when
  // the topic isn't approved yet.
  const { data: dashboardSnap } = useQuery<DashboardSnapshot>({
    queryKey: ["upload-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/student")
      const json = await res.json()
      return {
        hasProject: !!json.data?.hasProject,
        project: json.data?.project
          ? {
              id: json.data.project.id,
              title: json.data.project.title,
              status: json.data.project.status,
            }
          : null,
        latestTopic: json.data?.latestTopic ?? null,
      }
    },
  })
  const { data: milestones } = useQuery<Milestone[]>({
    queryKey: ["upload-milestones"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/student")
      const json = await res.json()
      return json.data?.project?.milestones ?? []
    },
  })

  const milestoneList = milestones ?? []
  // Filter out document types whose mapped milestone is COMPLETED.
  const docTypeOptions = ALL_DOC_TYPE_OPTIONS.filter(
    (o) => !isDocTypeLocked(o.value, milestoneList),
  )

  const uploadMutation = useMutation({
    mutationFn: async () => {
      // ── Direct-to-Cloudinary upload (3 steps) ──────────────────────────
      // Keeps the file body out of the serverless function so the 10MB limit
      // works on Vercel (which caps request bodies at ~4.5MB).

      // 1. Get signed upload params (also authorizes the student + project).
      const urlRes = await fetch("/api/documents/upload-url")
      const urlJson = await urlRes.json()
      if (!urlRes.ok || !urlJson?.data) {
        throw new Error(urlJson?.error ?? "Could not authorize upload")
      }
      const {
        uploadUrl,
        folder,
        timestamp,
        signature,
        apiKey,
        type,
      }: {
        uploadUrl: string
        folder: string
        timestamp: number
        signature: string
        apiKey: string
        type: string
      } = urlJson.data

      // 2. Upload the file straight to Cloudinary. `type` must be sent so it
      // matches the signed params (files are private/authenticated).
      const cloudForm = new FormData()
      cloudForm.append("file", file!)
      cloudForm.append("folder", folder)
      cloudForm.append("timestamp", String(timestamp))
      cloudForm.append("signature", signature)
      cloudForm.append("api_key", apiKey)
      cloudForm.append("type", type)
      const cloudRes = await fetch(uploadUrl, { method: "POST", body: cloudForm })
      if (!cloudRes.ok) {
        const detail = await cloudRes.text().catch(() => "")
        throw new Error(`Cloudinary upload failed${detail ? `: ${detail}` : ""}`)
      }
      const cloudJson = await cloudRes.json()
      const publicId: string | undefined = cloudJson?.public_id
      if (!publicId) throw new Error("Cloudinary did not return a public_id")

      // 3. Register the asset with the backend (creates the Document row).
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId,
          fileName: file!.name,
          fileSize: file!.size,
          fileType: file!.type,
          title: title.trim(),
          description: description.trim(),
          documentType: effectiveDocType,
          isFinal: isFinal && effectiveDocType === "FINAL_REPORT",
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        // The DB write failed after a successful Cloudinary upload — surface
        // the error so the user can retry; the orphaned asset is recoverable
        // later via the migration reconcile step.
        throw new Error(json.error ?? "Upload failed")
      }
      return json
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setFile(null)
      setTitle("")
      setDescription("")
      setDocType("DRAFT")
      setIsFinal(false)
      queryClient.invalidateQueries({ queryKey: ["my-documents"] })
      queryClient.invalidateQueries({ queryKey: ["document-versions"] })
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(
        `/api/documents/${docId}`,
        { method: "DELETE" },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Delete failed")
      return json
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ["my-documents"] })
      queryClient.invalidateQueries({ queryKey: ["document-versions"] })
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error("Please select a file first")
      return
    }
    uploadMutation.mutate()
  }

  const documents = docs ?? []
  const existingVersion = versionsData?.counts[docType] ?? 0
  const nextVersion = existingVersion + 1

  // If the currently-selected doc type is locked (its milestone was marked
  // complete after the user picked it), auto-switch to the first available
  // type so the form never submits a locked type.
  const selectedLocked = isDocTypeLocked(docType, milestoneList)
  const effectiveDocType = selectedLocked
    ? docTypeOptions[0]?.value ?? "DRAFT"
    : docType
  const allLocked = docTypeOptions.length === 0

  // ── Upload-gate logic ──
  // The upload UI is ONLY shown when the student has an active, approved
  // project (status IN_PROGRESS / SUBMITTED / APPROVED). In every other
  // case — no topic, topic pending/rejected/revision, topic approved but
  // project not yet created, or project still NOT_STARTED — we hide the
  // upload form and show a clear "topic not approved yet" message with a
  // Contact-Supervisor button that routes to the chat screen.
  const project = dashboardSnap?.project ?? null
  const latestTopic = dashboardSnap?.latestTopic ?? null
  const uploadAllowed =
    !!project &&
    project.status !== "NOT_STARTED"

  if (!uploadAllowed) {
    const reason =
      !project && !latestTopic
        ? "no_topic"
        : !project
          ? latestTopic.status === "PENDING"
            ? "topic_pending"
            : latestTopic.status === "REJECTED"
              ? "topic_rejected"
              : latestTopic.status === "REVISION_REQUIRED"
                ? "topic_revision"
                : "topic_approved_pending_project"
          : "project_not_started" // project exists but NOT_STARTED
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-slate-800">Upload Document</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload project documents for your supervisor to review.
          </p>
        </motion.div>
        <NotApprovedGate
          topic={latestTopic}
          projectTitle={project?.title ?? null}
          reason={reason as "no_topic" | "topic_pending" | "topic_rejected" | "topic_revision" | "topic_approved_pending_project" | "project_not_started"}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-800">Upload Document</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload project documents for your supervisor to review. Allowed
          formats: PDF, DOCX, DOC (max 10MB).
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Upload form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-3"
        >
          <Card className="rounded-xl border-slate-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Upload a New Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {allLocked ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="text-xs">
                      <p className="font-semibold text-emerald-800">
                        All project phases completed
                      </p>
                      <p className="mt-0.5 text-emerald-700">
                        Every document type belongs to a milestone that has
                        been marked complete. You can still upload general
                        drafts, methodology notes, or miscellaneous files
                        using the &ldquo;Other&rdquo; type below if available.
                        Contact your supervisor if you need to revise a
                        completed phase.
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">
                    Document Type <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={effectiveDocType}
                    onValueChange={(v) => {
                      setDocType(v as DocumentType)
                      if (v !== "FINAL_REPORT") setIsFinal(false)
                    }}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {docTypeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex w-full items-center justify-between gap-2">
                            <span>{o.label}</span>
                            <span className="text-[10px] text-slate-400">
                              {o.hint}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLocked && !allLocked && (
                    <p className="text-xs text-amber-600">
                      The previously selected type belongs to a completed
                      phase — switched to {docTypeOptions[0]?.label}.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doc-title" className="text-sm text-slate-700">
                    Title <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="doc-title"
                    placeholder="e.g. Chapter 1 - Introduction (Draft)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    minLength={3}
                    maxLength={150}
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-desc"
                    className="text-sm text-slate-700"
                  >
                    Description{" "}
                    <span className="text-slate-400">(optional)</span>
                  </Label>
                  <Textarea
                    id="doc-desc"
                    placeholder="Briefly describe what this document contains..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">
                    File <span className="text-rose-500">*</span>
                  </Label>
                  <FileUploader onFileSelect={setFile} accept=".pdf,.docx,.doc" maxSizeMB={10} />
                </div>

                {/* Version warning */}
                {existingVersion > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-800">
                        Version {nextVersion} will be created
                      </p>
                      <p className="mt-0.5 text-amber-700">
                        A{" "}
                        <span className="font-medium">
                          {docType.replace(/_/g, " ")}
                        </span>{" "}
                        document already exists (Version {existingVersion}).
                        This upload will be saved as Version {nextVersion}. Your
                        supervisor will be able to compare versions.
                      </p>
                    </div>
                  </div>
                )}

                {/* Final submission checkbox (only for FINAL_REPORT) */}
                {docType === "FINAL_REPORT" && (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5">
                    <input
                      type="checkbox"
                      id="isFinal"
                      checked={isFinal}
                      onChange={(e) => setIsFinal(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="isFinal"
                        className="cursor-pointer text-sm font-semibold text-emerald-800"
                      >
                        Mark as Final Project Submission
                      </Label>
                      <p className="mt-0.5 text-xs leading-relaxed text-emerald-700">
                        Checking this will change your project status to
                        &ldquo;Submitted&rdquo; and notify your supervisor that
                        your final report is ready for review. Make sure
                        you&apos;ve addressed all previous feedback before
                        checking this.
                      </p>
                      {isFinal && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                          <Flag className="h-3 w-3" />
                          Final submission flag is ON. Your project status will
                          update on upload.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    uploadMutation.isPending || !file || title.trim().length < 3
                  }
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : isFinal ? (
                    <Flag className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  {isFinal
                    ? "Submit Final Report"
                    : existingVersion > 0
                      ? `Upload as Version ${nextVersion}`
                      : "Upload Document"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* My documents list */}
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
                  My Documents ({documents.length})
                </CardTitle>
                {documents.some((d) => d.isFinal) && (
                  <Badge className="bg-emerald-100 text-[10px] text-emerald-700">
                    <Flag className="mr-0.5 h-2.5 w-2.5" />
                    Final submitted
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : documents.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Upload your first document using the form on the left."
                />
              ) : (
                <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                  {documents.map((d) => {
                    const pendingFb = d.feedback.filter(
                      (f) => f.status === "PENDING",
                    ).length
                    return (
                      <div
                        key={d.id}
                        className="rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50/50"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <FileText className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-slate-700">
                                {d.title}
                              </p>
                              {d.isFinal && (
                                <Badge className="bg-emerald-100 text-[10px] text-emerald-700">
                                  Final
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">
                              {d.fileName} · {formatFileSize(d.fileSize)}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Badge
                                className={`text-[10px] ${docTypeBadge[d.documentType]}`}
                              >
                                {d.documentType.replace(/_/g, " ")}
                              </Badge>
                              <Badge className="bg-slate-50 text-[10px] text-slate-500">
                                v{d.version}
                              </Badge>
                              <span className="text-[10px] text-slate-400">
                                {format(new Date(d.createdAt), "MMM d, yyyy")}
                              </span>
                              {d.feedback.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                                  <FileCheck className="h-2.5 w-2.5" />
                                  {d.feedback.length} feedback
                                  {pendingFb > 0 && (
                                    <span className="ml-0.5 rounded bg-amber-100 px-1 font-semibold text-amber-700">
                                      {pendingFb} new
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1">
                              <Button
                                asChild
                                size="sm"
                                variant="ghost"
                                className="h-7 rounded px-2 text-[11px] text-emerald-600 hover:bg-emerald-50"
                              >
                                <Link
                                  href={`/student/document-review/${d.id}`}
                                >
                                  <MessageCircle className="mr-1 h-3 w-3" />
                                  Review
                                  {d.feedback.length > 0 && (
                                    <span className="ml-1 rounded bg-emerald-100 px-1 font-semibold text-emerald-700">
                                      {d.feedback.length}
                                    </span>
                                  )}
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 rounded px-2 text-[11px] text-slate-500 hover:bg-slate-50"
                                onClick={() => {
                                  window.open(
                                    `/api/documents/${d.id}/download`,
                                    "_blank",
                                  )
                                }}
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 rounded px-2 text-[11px] text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                onClick={() => setDeleteTarget(d)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-800">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Delete document?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              You are about to delete{" "}
              <span className="font-medium text-slate-700">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>{" "}
              (v{deleteTarget?.version}). This will also remove{" "}
              {deleteTarget?.feedback.length ?? 0} feedback item
              {(deleteTarget?.feedback.length ?? 0) !== 1 ? "s" : ""} attached
              to this document. The file will be removed from the server. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-rose-600 hover:bg-rose-700"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
