import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { signUploadParams } from "@/lib/cloudinary"

// GET /api/documents/upload-url
//
// Authorizes the student and returns the signed Cloudinary parameters the
// browser needs to upload a document DIRECTLY to Cloudinary (bypassing the
// serverless function body, so the 10MB limit works on Vercel).
//
// The browser then:
//   1. POSTs the file to https://api.cloudinary.com/v1_1/<cloud>/raw/upload
//      with these params + the file.
//   2. POSTs the returned public_id + metadata to /api/documents/upload,
//      which creates the Document row.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { success: false, error: "Only students can upload project documents" },
      { status: 403 },
    )
  }

  // The student must have a project (with a supervisor assigned) before we
  // hand out upload credentials.
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

  const params = signUploadParams(project.id)

  return NextResponse.json({
    success: true,
    data: {
      // The URL the browser posts the file to.
      uploadUrl: `https://api.cloudinary.com/v1_1/${params.cloudName}/raw/upload`,
      folder: params.folder,
      timestamp: params.timestamp,
      signature: params.signature,
      apiKey: params.apiKey,
      // Cloudinary returns the full public_id (folder/name) after upload;
      // the browser forwards it to /api/documents/upload.
    },
  })
}
