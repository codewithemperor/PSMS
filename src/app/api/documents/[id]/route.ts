import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { destroyAsset } from "@/lib/cloudinary"

// GET /api/documents/[id] — single document with project + feedback
// Role-filtered: supervisor can only see docs in their projects; student their own.
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
      documentType: true,
      version: true,
      isFinal: true,
      createdAt: true,
      uploadedBy: {
        select: { id: true, name: true, email: true, matricNo: true },
      },
      project: {
        select: {
          id: true,
          title: true,
          studentId: true,
          supervisorId: true,
          student: { select: { id: true, name: true } },
        },
      },
      feedback: {
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
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
  if (
    session.user.role === "STUDENT" &&
    doc.uploadedBy.id !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }
  if (
    session.user.role === "SUPERVISOR" &&
    doc.project.supervisorId !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }

  return NextResponse.json({ success: true, data: doc })
}

// DELETE /api/documents/[id] — remove a document
// STUDENT: only their own uploads. ADMIN: any document. SUPERVISOR: forbidden.
// Also removes the file from disk and cascades feedback (via onDelete: SET NULL
// for Feedback.document — we manually delete feedback first to be safe).
export async function DELETE(
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
      fileName: true,
      filePath: true,
      documentType: true,
      version: true,
      isFinal: true,
      uploadedById: true,
      project: {
        select: {
          id: true,
          title: true,
          studentId: true,
          supervisorId: true,
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

  // Authorization
  if (session.user.role === "STUDENT") {
    if (doc.uploadedById !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own documents" },
        { status: 403 },
      )
    }
  } else if (session.user.role === "SUPERVISOR") {
    return NextResponse.json(
      {
        success: false,
        error: "Supervisors cannot delete student documents. Ask the student or an admin.",
      },
      { status: 403 },
    )
  }
  // ADMIN can delete anything

  // Delete feedback rows referencing this document first (defensive — schema
  // has onDelete: SET NULL, but explicit is safer).
  await db.feedback.deleteMany({ where: { documentId: id } })

  // Delete the Document row
  await db.document.delete({ where: { id } })

  // Best-effort: remove the Cloudinary asset (filePath holds the public_id).
  // Failure is non-fatal — the row is already gone; an orphaned asset is
  // recoverable later. We do this AFTER the row delete so the user never
  // sees a stale DB entry pointing at a destroyed asset.
  await destroyAsset(doc.filePath)

  return NextResponse.json({
    success: true,
    message: `Document "${doc.title}" (v${doc.version}) deleted`,
  })
}
