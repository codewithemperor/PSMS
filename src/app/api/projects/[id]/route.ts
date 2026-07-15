import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { ProjectStatus } from "@prisma/client"

// GET /api/projects/[id] — full project bundle (project + student + topics +
// documents + milestones + feedback). SUPERVISOR (must own) or ADMIN.
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

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      progress: true,
      startDate: true,
      expectedEndDate: true,
      submittedAt: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          matricNo: true,
          department: true,
          phone: true,
          avatar: true,
          studentProfile: {
            select: { level: true, programme: true, enrollmentYear: true },
          },
        },
      },
      supervisor: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          supervisorProfile: {
            select: { specialization: true, bio: true },
          },
        },
      },
      topics: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          reviewerComment: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        select: {
          id: true,
          title: true,
          description: true,
          documentType: true,
          version: true,
          fileName: true,
          fileSize: true,
          fileType: true,
          isFinal: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
          _count: { select: { feedback: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      milestones: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          order: true,
          weight: true,
          dueDate: true,
          completedDate: true,
          createdAt: true,
        },
        orderBy: { order: "asc" },
      },
      feedback: {
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
          document: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!project) {
    return NextResponse.json(
      { success: false, error: "Project not found" },
      { status: 404 },
    )
  }

  // Role guard: supervisor must own; admin can view any; student must own
  if (
    session.user.role === "SUPERVISOR" &&
    project.supervisor.id !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }
  if (
    session.user.role === "STUDENT" &&
    project.student.id !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "You are not the owner of this project" },
      { status: 403 },
    )
  }

  return NextResponse.json({ success: true, data: { project } })
}

// PATCH /api/projects/[id] — update project status / progress / dates
// Supervisor-only (must own project) or ADMIN.
export async function PATCH(
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

  let body: {
    status?: ProjectStatus
    progress?: number
    expectedEndDate?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      supervisorId: true,
      studentId: true,
      status: true,
      progress: true,
    },
  })
  if (!project) {
    return NextResponse.json(
      { success: false, error: "Project not found" },
      { status: 404 },
    )
  }

  // Role guard: supervisor must own; admin can edit any
  if (
    session.user.role === "SUPERVISOR" &&
    project.supervisorId !== session.user.id
  ) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }
  if (session.user.role === "STUDENT") {
    return NextResponse.json(
      { success: false, error: "Students cannot edit projects" },
      { status: 403 },
    )
  }

  // Validate inputs
  const updates: {
    status?: ProjectStatus
    progress?: number
    expectedEndDate?: Date
    submittedAt?: Date
    approvedAt?: Date
  } = {}

  if (body.status) {
    if (
      ![
        "NOT_STARTED",
        "IN_PROGRESS",
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
      ].includes(body.status)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      )
    }
    updates.status = body.status
    if (body.status === "SUBMITTED" && !project.submittedAt) {
      updates.submittedAt = new Date()
    }
    if (body.status === "APPROVED" && !project.approvedAt) {
      updates.approvedAt = new Date()
    }
  }
  if (typeof body.progress === "number") {
    if (body.progress < 0 || body.progress > 100) {
      return NextResponse.json(
        { success: false, error: "Progress must be between 0 and 100" },
        { status: 400 },
      )
    }
    updates.progress = Math.round(body.progress)
  }
  if (body.expectedEndDate) {
    const d = new Date(body.expectedEndDate)
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid expectedEndDate" },
        { status: 400 },
      )
    }
    updates.expectedEndDate = d
  }

  const updated = await db.project.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      status: true,
      progress: true,
      expectedEndDate: true,
      submittedAt: true,
      approvedAt: true,
    },
  })

  // Notify student on status changes
  if (updates.status && updates.status !== project.status) {
    await db.notification.create({
      data: {
        title: "Project Status Updated",
        message: `Your project "${project.title}" status changed from ${project.status.replace(/_/g, " ")} to ${updates.status.replace(/_/g, " ")}.`,
        type: "INFO",
        userId: project.studentId,
        link: `/student/project`,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: "Project updated",
  })
}
