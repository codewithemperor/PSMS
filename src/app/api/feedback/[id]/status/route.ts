import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { FeedbackStatus } from "@prisma/client"

// PUT /api/feedback/[id]/status — student updates feedback status
// Body: { status: "ADDRESSED" | "DISMISSED" }
// Spec-compliant endpoint (alongside the existing PATCH /api/feedback/[id]).
// Only the feedback's student can do this. Supervisors cannot change status.
export async function PUT(
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

  let body: { status?: FeedbackStatus }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const newStatus = body.status
  if (
    !newStatus ||
    !["ADDRESSED", "DISMISSED"].includes(newStatus)
  ) {
    return NextResponse.json(
      { success: false, error: "Status must be ADDRESSED or DISMISSED" },
      { status: 400 },
    )
  }

  const feedback = await db.feedback.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      authorId: true,
      content: true,
      status: true,
      project: { select: { title: true } },
    },
  })
  if (!feedback) {
    return NextResponse.json(
      { success: false, error: "Feedback not found" },
      { status: 404 },
    )
  }

  // Only the student who received the feedback can update its status
  if (session.user.role === "STUDENT") {
    if (feedback.studentId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only update feedback addressed to you" },
        { status: 403 },
      )
    }
  } else if (session.user.role === "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Supervisors cannot change feedback status" },
      { status: 403 },
    )
  }

  const updated = await db.feedback.update({
    where: { id },
    data: { status: newStatus },
    select: {
      id: true,
      status: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  })

  // Notify the feedback author (supervisor) when their feedback was addressed
  if (newStatus === "ADDRESSED") {
    await db.notification.create({
      data: {
        title: "Feedback Addressed",
        message: `Your feedback on "${feedback.project.title}" was marked as addressed by the student.`,
        type: "INFO",
        userId: feedback.authorId,
        link: "/supervisor/students",
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: `Feedback marked as ${newStatus.toLowerCase()}`,
  })
}
