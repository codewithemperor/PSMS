import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { DocumentType } from "@prisma/client"

// POST /api/documents/upload — student uploads a project document.
//
// This is the SECOND step of the direct-to-Cloudinary flow:
//   1. Browser got signed params from /api/documents/upload-url.
//   2. Browser uploaded the file straight to Cloudinary.
//   3. Browser POSTs the resulting public_id + metadata HERE.
//
// Accepts application/json:
//   - publicId:     Cloudinary public_id returned after the raw upload
//   - fileName:     original file name (for display + Content-Disposition)
//   - fileSize:     bytes (the browser knows from the File object)
//   - fileType:     MIME type
//   - title:        document title (3–150 chars)
//   - description:  optional
//   - documentType: one of DocumentType enum
//   - isFinal:      boolean — only valid when documentType === "FINAL_REPORT"
//
// Behavior:
//   - Computes the next version number for this (project, documentType) pair.
//   - Stores the Cloudinary public_id in Document.filePath.
//   - Creates a Document row.
//   - If isFinal, marks the Project status = SUBMITTED + sets submittedAt.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      {
        success: false,
        error: "Only students can upload project documents",
      },
      { status: 403 },
    )
  }

  // The student must have a project (with a supervisor assigned).
  const project = await db.project.findUnique({
    where: { studentId: session.user.id },
    select: { id: true, title: true, status: true, supervisorId: true },
  })
  if (!project) {
    return NextResponse.json(
      {
        success: false,
        error:
          "You don't have a project yet. Please submit and get a topic approved first.",
      },
      { status: 400 },
    )
  }

  // Parse JSON body
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    )
  }

  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : ""
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null
  const documentType = typeof body.documentType === "string" ? body.documentType : ""
  const isFinalFlag = body.isFinal
  const fileSize =
    typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
      ? body.fileSize
      : 0
  const fileType = typeof body.fileType === "string" ? body.fileType.trim() : ""

  // Validate Cloudinary public_id — must live under this project's folder so
  // a student can't register an asset from another project.
  const expectedPrefix = `psms/${project.id}/`
  if (!publicId || !publicId.startsWith(expectedPrefix)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid or missing Cloudinary public_id for this project.",
      },
      { status: 400 },
    )
  }

  // Validate file metadata presence
  if (!fileName) {
    return NextResponse.json(
      { success: false, error: "Missing fileName" },
      { status: 400 },
    )
  }

  // Validate title
  if (title.length < 3 || title.length > 150) {
    return NextResponse.json(
      { success: false, error: "Title must be between 3 and 150 characters" },
      { status: 400 },
    )
  }

  // Validate documentType
  const validTypes: DocumentType[] = [
    "PROPOSAL",
    "DRAFT",
    "LITERATURE_REVIEW",
    "METHODOLOGY",
    "DATA_ANALYSIS",
    "FINAL_REPORT",
    "OTHER",
  ]
  if (!documentType || !validTypes.includes(documentType as DocumentType)) {
    return NextResponse.json(
      { success: false, error: "Invalid or missing document type" },
      { status: 400 },
    )
  }
  const docType = documentType as DocumentType

  // Validate file extension (kept server-side as a second line of defense;
  // the browser already checks this in FileUploader).
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
  const allowedExt = [".pdf", ".docx", ".doc"]
  if (!allowedExt.includes(ext)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported file type "${ext || "none"}". Allowed: PDF, DOCX, DOC`,
      },
      { status: 400 },
    )
  }

  // isFinal only allowed for FINAL_REPORT
  const isFinal = isFinalFlag === true && docType === "FINAL_REPORT"

  // Compute next version for this (project, documentType)
  const existingCount = await db.document.count({
    where: { projectId: project.id, documentType: docType },
  })
  const version = existingCount + 1

  // Create the Document row. filePath now holds the Cloudinary public_id.
  const doc = await db.document.create({
    data: {
      title,
      description,
      fileName,
      fileSize,
      fileType: fileType || ext,
      filePath: publicId,
      version,
      documentType: docType,
      isFinal,
      projectId: project.id,
      uploadedById: session.user.id,
    },
  })

  // If final submission, update project status
  if (isFinal) {
    await db.project.update({
      where: { id: project.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    })
  }

  return NextResponse.json({
    success: true,
    message: isFinal
      ? `Final report submitted! Your project status is now "Submitted". (v${version})`
      : `Document "${title}" uploaded successfully as version ${version}.`,
    data: {
      id: doc.id,
      title,
      documentType: docType,
      version,
      isFinal,
      projectId: project.id,
    },
  })
}
