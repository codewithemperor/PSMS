import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { signedDownloadUrl } from "@/lib/cloudinary"

// GET /api/documents/[id]/download — redirect to a short-lived signed
// Cloudinary URL. Role-guarded: student can only download their own;
// supervisor only their projects' docs; admin can download any.
//
// Document.filePath now holds the Cloudinary public_id of the raw asset.
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
      fileName: true,
      fileType: true,
      filePath: true,
      uploadedById: true,
      project: {
        select: { supervisorId: true },
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
    doc.uploadedById !== session.user.id
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

  // filePath is the Cloudinary public_id. Generate a signed URL and redirect.
  const url = signedDownloadUrl(doc.filePath, doc.fileName)
  return NextResponse.redirect(url, { status: 302 })
}
