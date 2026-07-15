import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/document-review/[id] — full review thread for a document.
//
// Returns:
//   - document (id, title, description, fileName, fileSize, fileType,
//     version, documentType, isFinal, createdAt, uploadedBy)
//   - project (id, title, status, student, supervisor)
//   - feedback: ALL feedback rows for this document, oldest-first (so the
//     timeline reads top→bottom like a chat). Includes author id/name/role.
//   - versions: every document in the same project with the same
//     documentType, ordered by version asc — lets the UI render a version
//     switcher and jump between per-version review threads.
//
// Access:
//   - ADMIN: any document
//   - SUPERVISOR: must be the project's supervisor
//   - STUDENT: must be the project's student (i.e. the uploader's project)
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
      description: true,
      fileName: true,
      fileSize: true,
      fileType: true,
      filePath: true,
      version: true,
      documentType: true,
      isFinal: true,
      createdAt: true,
      uploadedById: true,
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          studentId: true,
          supervisorId: true,
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              matricNo: true,
            },
          },
          supervisor: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              supervisorProfile: { select: { specialization: true } },
            },
          },
        },
      },
      uploadedBy: { select: { id: true, name: true, role: true } },
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
    if (doc.project.studentId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      )
    }
  }

  // Full feedback thread (oldest first → chat timeline)
  const feedback = await db.feedback.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      status: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
    },
  })

  // Other versions of the same document type in the same project
  const versions = await db.document.findMany({
    where: {
      projectId: doc.project.id,
      documentType: doc.documentType,
    },
    orderBy: { version: "asc" },
    select: {
      id: true,
      title: true,
      version: true,
      isFinal: true,
      createdAt: true,
      fileName: true,
      fileSize: true,
    },
  })

  // Pending feedback count for the banner
  const pendingCount = feedback.filter((f) => f.status === "PENDING").length

  return NextResponse.json({
    success: true,
    data: {
      document: {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileType: doc.fileType,
        version: doc.version,
        documentType: doc.documentType,
        isFinal: doc.isFinal,
        createdAt: doc.createdAt.toISOString(),
        uploadedBy: doc.uploadedBy,
      },
      project: {
        id: doc.project.id,
        title: doc.project.title,
        status: doc.project.status,
        student: doc.project.student,
        supervisor: doc.project.supervisor,
      },
      feedback,
      versions,
      pendingCount,
    },
  })
}

// POST /api/document-review/[id] — bidirectional reply on a document review.
//
// Either the project's SUPERVISOR or the project's STUDENT may post a reply.
// This is intentionally different from /api/feedback (supervisor-only) and
// /api/documents/[id]/feedback (supervisor-only) because the review page is
// a two-way conversation.
//
// Body: { content: string }  (min 5 chars)
// Creates a Feedback row linked to this document + project. Notifies the
// OTHER party (student → supervisor, supervisor → student).
export async function POST(
  request: Request,
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

  if (session.user.role !== "SUPERVISOR" && session.user.role !== "STUDENT") {
    return NextResponse.json(
      { success: false, error: "Only supervisors and students can reply" },
      { status: 403 },
    )
  }

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
  if (!content || content.length < 5) {
    return NextResponse.json(
      { success: false, error: "Reply must be at least 5 characters" },
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

  // Authorisation — must be a participant of the project
  const isSupervisor =
    session.user.role === "SUPERVISOR" &&
    doc.project.supervisorId === session.user.id
  const isStudent =
    session.user.role === "STUDENT" &&
    doc.project.studentId === session.user.id
  if (!isSupervisor && !isStudent) {
    return NextResponse.json(
      { success: false, error: "You are not a participant of this project" },
      { status: 403 },
    )
  }

  // Create the reply as a Feedback row tied to this document
  const reply = await db.feedback.create({
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
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
    },
  })

  // Notify the other party
  const recipientId = isSupervisor
    ? doc.project.studentId
    : doc.project.supervisorId
  const senderLabel = isSupervisor ? "Your supervisor" : "Your student"
  await db.notification.create({
    data: {
      title: "New Document Review Reply",
      message: `${senderLabel} replied on "${doc.title}" (v${doc.version}).`,
      type: "FEEDBACK_GIVEN",
      userId: recipientId,
      link: isSupervisor
        ? `/student/document-review/${id}`
        : `/supervisor/document-review/${id}`,
    },
  })

  return NextResponse.json(
    {
      success: true,
      data: reply,
      message: "Reply posted.",
    },
    { status: 201 },
  )
}
