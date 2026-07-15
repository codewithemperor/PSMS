import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/documents/[id]/feedback — list feedback for a document.
// Access: SUPERVISOR (must own the project), ADMIN, or STUDENT (own document).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const { id } = await params

  const doc = await db.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      version: true,
      documentType: true,
      uploadedById: true,
      project: {
        select: {
          id: true,
          title: true,
          supervisorId: true,
          studentId: true,
        },
      },
    },
  })
  if (!doc) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 },
    )
  }

  // Role guard
  if (session.user.role === "SUPERVISOR") {
    if (doc.project.supervisorId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      )
    }
  } else if (session.user.role === "STUDENT") {
    if (doc.uploadedById !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      )
    }
  }

  const feedback = await db.feedback.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      status: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatar: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: { document: doc, feedback },
  })
}

// POST /api/documents/[id]/feedback — supervisor gives feedback on a document.
// SUPERVISOR only (must own the project). Body: { content: string } min 10 chars.
// Creates Feedback + notifies the student (type: FEEDBACK_GIVEN).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Only supervisors can give feedback" },
      { status: 403 },
    )
  }
  const { id } = await params

  let body: { content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const content = body.content?.trim()
  if (!content || content.length < 10) {
    return NextResponse.json(
      { success: false, error: "Feedback must be at least 10 characters" },
      { status: 400 },
    )
  }

  const doc = await db.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      version: true,
      documentType: true,
      uploadedById: true,
      project: {
        select: {
          id: true,
          title: true,
          supervisorId: true,
          studentId: true,
        },
      },
    },
  })
  if (!doc) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 },
    )
  }
  if (doc.project.supervisorId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }

  const feedback = await db.feedback.create({
    data: {
      content,
      projectId: doc.project.id,
      studentId: doc.project.studentId,
      authorId: session.user.id,
      documentId: id,
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
      message: `Your supervisor gave feedback on "${doc.title}".`,
      type: "FEEDBACK_GIVEN",
      userId: doc.project.studentId,
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
