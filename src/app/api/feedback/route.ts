import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// GET /api/feedback — role-filtered feedback list
// - ADMIN: all
// - SUPERVISOR: feedback authored by them
// - STUDENT: feedback received by them
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const projectId = url.searchParams.get("projectId")
  const studentId = url.searchParams.get("studentId")

  const where: Prisma.FeedbackWhereInput = {}
  if (session.user.role === "SUPERVISOR") {
    where.authorId = session.user.id
  } else if (session.user.role === "STUDENT") {
    where.studentId = session.user.id
  }
  if (
    status &&
    ["PENDING", "ADDRESSED", "DISMISSED"].includes(status)
  ) {
    where.status = status as Prisma.FeedbackWhereInput["status"]
  }
  if (projectId) where.projectId = projectId
  if (studentId) where.studentId = studentId

  const feedback = await db.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      status: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      student: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      document: { select: { id: true, title: true } },
    },
    take: 100,
  })

  return NextResponse.json({ success: true, data: feedback })
}

// POST /api/feedback — supervisor creates feedback on a document or project
// Body: { projectId, studentId, content, documentId? }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Only supervisors can submit feedback" },
      { status: 403 },
    )
  }

  let body: {
    projectId?: string
    studentId?: string
    content?: string
    documentId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const { projectId, studentId, content, documentId } = body
  if (!projectId || !studentId || !content?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "projectId, studentId, and content are required",
      },
      { status: 400 },
    )
  }
  if (content.trim().length < 10) {
    return NextResponse.json(
      { success: false, error: "Feedback must be at least 10 characters" },
      { status: 400 },
    )
  }

  // Verify project belongs to this supervisor + the student matches
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, supervisorId: true, studentId: true, title: true },
  })
  if (!project) {
    return NextResponse.json(
      { success: false, error: "Project not found" },
      { status: 404 },
    )
  }
  if (project.supervisorId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }
  if (project.studentId !== studentId) {
    return NextResponse.json(
      { success: false, error: "Student does not match the project" },
      { status: 400 },
    )
  }

  // If documentId given, verify it belongs to the project
  if (documentId) {
    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { projectId: true },
    })
    if (!doc || doc.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: "Document does not belong to this project" },
        { status: 400 },
      )
    }
  }

  const feedback = await db.feedback.create({
    data: {
      content: content.trim(),
      projectId,
      studentId,
      authorId: session.user.id,
      documentId: documentId ?? null,
      status: "PENDING",
    },
    select: {
      id: true,
      content: true,
      status: true,
      createdAt: true,
    },
  })

  // Notify the student
  await db.notification.create({
    data: {
      title: "New Feedback",
      message: `Your supervisor gave feedback on "${project.title}"${documentId ? " (on a document)" : ""}.`,
      type: "FEEDBACK_GIVEN",
      userId: studentId,
      link: `/student/feedback`,
    },
  })

  return NextResponse.json(
    {
      success: true,
      data: feedback,
      message: "Feedback submitted. Student notified.",
    },
    { status: 201 },
  )
}
