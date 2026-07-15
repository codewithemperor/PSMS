import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { TopicStatus } from "@prisma/client"

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "request_revision"]),
  comment: z.string().optional(),
})

// POST /api/topics/[id]/approve
// Body: { action: "approve" | "reject" | "request_revision", comment?: string }
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
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Only admins and supervisors can review topics" },
      { status: 403 },
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }
  const { action, comment } = parsed.data

  // Comment required for reject and request_revision
  if (
    (action === "reject" || action === "request_revision") &&
    (!comment || comment.trim().length === 0)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: `A comment is required when ${action === "reject" ? "rejecting" : "requesting revision"}`,
      },
      { status: 400 },
    )
  }

  // --- Fetch the topic ---
  const topic = await db.topic.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } },
    },
  })

  if (!topic) {
    return NextResponse.json(
      { success: false, error: "Topic not found" },
      { status: 404 },
    )
  }

  // Supervisor can only review their own students' topics
  if (
    session.user.role === "SUPERVISOR" &&
    topic.supervisorId !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "You can only review topics assigned to you" },
      { status: 403 },
    )
  }

  // Only PENDING topics can be reviewed
  if (topic.status !== "PENDING") {
    return NextResponse.json(
      {
        success: false,
        error: `Topic is already ${topic.status.replace(/_/g, " ").toLowerCase()}`,
      },
      { status: 400 },
    )
  }

  // --- Map action to status + notification ---
  const statusMap: Record<string, TopicStatus> = {
    approve: "APPROVED",
    reject: "REJECTED",
    request_revision: "REVISION_REQUIRED",
  }
  const newStatus = statusMap[action]
  const notificationType =
    action === "approve"
      ? "TOPIC_APPROVED"
      : action === "reject"
        ? "TOPIC_REJECTED"
        : "INFO"

  const notificationTitle =
    action === "approve"
      ? "Topic Approved"
      : action === "reject"
        ? "Topic Rejected"
        : "Topic Requires Revision"

  const notificationMessage =
    action === "approve"
      ? `Your topic "${topic.title}" has been approved. A project has been created for you.`
      : action === "reject"
        ? `Your topic "${topic.title}" has been rejected.${comment ? ` Reason: ${comment}` : ""}`
        : `Your topic "${topic.title}" requires revision.${comment ? ` Comment: ${comment}` : ""}`

  // --- Transaction: update topic, optionally create project + milestones, notify student ---
  const result = await db.$transaction(async (tx) => {
    let projectId = topic.projectId

    // Update topic
    const updatedTopic = await tx.topic.update({
      where: { id },
      data: {
        status: newStatus,
        reviewerComment: comment?.trim() ?? null,
        reviewedAt: new Date(),
      },
    })

    // On approve: ensure project + milestones exist
    if (action === "approve") {
      // Check for existing project for this student (only one per student — schema @unique)
      const existingProject = await tx.project.findUnique({
        where: { studentId: topic.studentId },
        select: { id: true, supervisorId: true },
      })

      if (existingProject) {
        projectId = existingProject.id
        // Link topic to existing project
        await tx.topic.update({
          where: { id },
          data: { projectId: existingProject.id },
        })
        // If the existing project's supervisor differs from the topic's
        // reviewer (e.g. student was reassigned while the topic was pending),
        // re-point the project to the reviewing supervisor so all three
        // sources of truth (Project.supervisorId, active Allocation,
        // StudentProfile.supervisorId) stay consistent.
        if (
          topic.supervisorId &&
          existingProject.supervisorId !== topic.supervisorId
        ) {
          await tx.project.update({
            where: { id: existingProject.id },
            data: { supervisorId: topic.supervisorId },
          })
        }
      } else {
        // Create new project
        const newProject = await tx.project.create({
          data: {
            title: topic.title,
            description: topic.description,
            studentId: topic.studentId,
            supervisorId: topic.supervisorId,
            status: "IN_PROGRESS",
            progress: 10,
            startDate: new Date(),
          },
        })
        projectId = newProject.id

        // Link topic to project
        await tx.topic.update({
          where: { id },
          data: { projectId: newProject.id },
        })

        // Create 5 default milestones
        const now = new Date()
        const milestones = [
          {
            name: "Topic Approval",
            description: "Initial project topic has been approved by the supervisor.",
            status: "COMPLETED" as const,
            order: 1,
            weight: 10,
            dueDate: now,
            completedDate: now,
          },
          {
            name: "Proposal Submission",
            description: "Submit the detailed project proposal document.",
            status: "NOT_STARTED" as const,
            order: 2,
            weight: 15,
            dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            name: "Literature Review",
            description: "Complete a comprehensive review of related work.",
            status: "NOT_STARTED" as const,
            order: 3,
            weight: 20,
            dueDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
          },
          {
            name: "Data Collection & Analysis",
            description: "Collect and analyze research data.",
            status: "NOT_STARTED" as const,
            order: 4,
            weight: 25,
            dueDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          },
          {
            name: "Final Report & Submission",
            description: "Compile the final project report and submit for grading.",
            status: "NOT_STARTED" as const,
            order: 5,
            weight: 30,
            dueDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
          },
        ]

        await tx.milestone.createMany({
          data: milestones.map((m) => ({
            ...m,
            projectId: newProject.id,
          })),
        })
      }

      // *** ALLOCATION SYNC ***
      // The single source of truth for "who is this student's supervisor
      // right now" is the ACTIVE Allocation. A student can reach topic
      // approval WITHOUT an allocation (e.g. topic submit auto-picked a
      // supervisor via the lowest-load fallback, or the admin approved a
      // topic for a student who was never explicitly allocated). Without
      // an allocation, the student appears in the supervisor's project
      // count (Project.supervisorId) but NOT in the My Students list
      // (allocation-based) — producing the "4 active projects but 2
      // students" mismatch the user reported.
      //
      // On approval we therefore ensure an ACTIVE allocation exists for
      // this student→supervisor pair:
      //   - If one already exists for the SAME supervisor → leave it.
      //   - If one exists for a DIFFERENT supervisor → revoke it first
      //     (reassignment) and decrement the old supervisor's load.
      //   - If none exists → create a fresh ACTIVE allocation.
      // We also keep StudentProfile.supervisorId and the project's
      // supervisorId in sync, and recompute SupervisorProfile.currentLoad
      // from the allocation table (never trust the stored counter).
      const supervisorId = topic.supervisorId!
      const studentId = topic.studentId

      const existingActiveAlloc = await tx.allocation.findFirst({
        where: { studentId, status: "ACTIVE" },
        select: { id: true, supervisorId: true },
      })

      if (!existingActiveAlloc) {
        // No active allocation — create one.
        await tx.allocation.create({
          data: {
            studentId,
            supervisorId,
            academicYear: "Current",
            semester: "Full Session",
            status: "ACTIVE",
            allocatedBy: session.user.id!,
          },
        })
      } else if (existingActiveAlloc.supervisorId !== supervisorId) {
        // Reassignment: revoke the old allocation, create a new one.
        await tx.allocation.update({
          where: { id: existingActiveAlloc.id },
          data: { status: "REVOKED" },
        })
        await tx.allocation.create({
          data: {
            studentId,
            supervisorId,
            academicYear: "Current",
            semester: "Full Session",
            status: "ACTIVE",
            allocatedBy: session.user.id!,
          },
        })
      }

      // Sync StudentProfile.supervisorId (upsert the profile if missing).
      await tx.studentProfile.upsert({
        where: { userId: studentId },
        update: { supervisorId },
        create: { userId: studentId, supervisorId },
      })

      // Recompute currentLoad for every affected supervisor from the
      // allocation table (the authoritative source).
      const affectedSupervisors = new Set<string>([supervisorId])
      if (existingActiveAlloc) {
        affectedSupervisors.add(existingActiveAlloc.supervisorId)
      }
      for (const supId of affectedSupervisors) {
        const count = await tx.allocation.count({
          where: { supervisorId: supId, status: "ACTIVE" },
        })
        await tx.supervisorProfile.updateMany({
          where: { userId: supId },
          data: { currentLoad: count },
        })
      }
    }

    // Notify the student
    // Per spec: topic-approved/rejected student notifications link to /student/topic
    await tx.notification.create({
      data: {
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        userId: topic.studentId,
        link: "/student/topic",
      },
    })

    return { updatedTopic, projectId }
  })

  return NextResponse.json({
    success: true,
    message: `Topic ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "marked for revision"} successfully`,
    data: {
      topicId: result.updatedTopic.id,
      status: result.updatedTopic.status,
      projectId: result.projectId,
    },
  })
}
