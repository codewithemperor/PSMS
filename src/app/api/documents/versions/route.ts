import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { DocumentType } from "@prisma/client"

// GET /api/documents/versions — version count per document type for a project
// Query: projectId (required for non-students; students can omit and their own
// project is used).
// Returns: { projectId, types: { PROPOSAL: 1, DRAFT: 0, ... }, nextVersionByType }
//
// Used by the upload form's "version warning" UI — if a student is about to
// upload a PROPOSAL and one already exists, the form warns "this will be v2".
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  let projectId = url.searchParams.get("projectId")

  // If no projectId, fall back to the student's own project
  if (!projectId) {
    if (session.user.role !== "STUDENT") {
      return NextResponse.json(
        { success: false, error: "projectId is required" },
        { status: 400 },
      )
    }
    const project = await db.project.findUnique({
      where: { studentId: session.user.id },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: "You don't have a project yet" },
        { status: 400 },
      )
    }
    projectId = project.id
  }

  // Authorization: student must own project; supervisor must be assigned
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      studentId: true,
      supervisorId: true,
    },
  })
  if (!project) {
    return NextResponse.json(
      { success: false, error: "Project not found" },
      { status: 404 },
    )
  }
  if (
    session.user.role === "STUDENT" &&
    project.studentId !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }
  if (
    session.user.role === "SUPERVISOR" &&
    project.supervisorId !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }

  // Count documents grouped by documentType
  const grouped = await db.document.groupBy({
    by: ["documentType"],
    _count: { documentType: true },
    where: { projectId },
  })

  const allTypes: DocumentType[] = [
    "PROPOSAL",
    "DRAFT",
    "LITERATURE_REVIEW",
    "METHODOLOGY",
    "DATA_ANALYSIS",
    "FINAL_REPORT",
    "OTHER",
  ]
  const counts: Record<string, number> = {}
  allTypes.forEach((t) => (counts[t] = 0))
  grouped.forEach((g) => {
    counts[g.documentType] = g._count.documentType
  })
  const nextVersionByType: Record<string, number> = {}
  allTypes.forEach((t) => {
    nextVersionByType[t] = counts[t] + 1
  })

  return NextResponse.json({
    success: true,
    data: {
      projectId,
      projectTitle: project.title,
      counts,
      nextVersionByType,
    },
  })
}
