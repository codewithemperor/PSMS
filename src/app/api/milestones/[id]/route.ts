import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { MilestoneStatus } from "@prisma/client"

// PATCH /api/milestones/[id] — update milestone status.
// Supervisor-only. When marking COMPLETED, auto-set completedDate + recompute
// project progress from milestone weights. If ALL milestones are COMPLETED,
// flip project status to SUBMITTED. Notify student when a milestone completes.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Only supervisors can update milestones" },
      { status: 403 },
    )
  }
  const { id } = await params

  let body: { status?: MilestoneStatus }
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
    !["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"].includes(newStatus)
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 },
    )
  }

  // Fetch milestone + verify ownership
  const milestone = await db.milestone.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      projectId: true,
      status: true,
      weight: true,
      order: true,
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          supervisorId: true,
          studentId: true,
          progress: true,
          milestones: {
            select: { id: true, weight: true, status: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  })
  if (!milestone) {
    return NextResponse.json(
      { success: false, error: "Milestone not found" },
      { status: 404 },
    )
  }
  if (milestone.project.supervisorId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }

  // COMPLETED milestones are locked — they cannot be re-marked as completed
  // or moved back to another status. (User rule: "a milestone that is
  // clicked completed should not have mark as completed again or have the
  // edit button.")
  if (milestone.status === "COMPLETED") {
    return NextResponse.json(
      {
        success: false,
        error:
          "This milestone is already completed and is locked. Completed milestones cannot be edited or have their status changed.",
      },
      { status: 400 },
    )
  }

  // Update milestone
  const updated = await db.milestone.update({
    where: { id },
    data: {
      status: newStatus,
      completedDate: newStatus === "COMPLETED" ? new Date() : null,
    },
    select: { id: true, status: true, completedDate: true },
  })

  // Recompute project progress from milestone weights
  const allMilestones = milestone.project.milestones.map((m) =>
    m.id === id ? { ...m, status: newStatus } : m,
  )
  const totalWeight = allMilestones.reduce((s, m) => s + m.weight, 0)
  const completedWeight = allMilestones
    .filter((m) => m.status === "COMPLETED")
    .reduce((s, m) => s + m.weight, 0)
  const newProgress =
    totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : milestone.project.progress

  // If ALL milestones COMPLETED, flip project status to SUBMITTED
  const allComplete =
    allMilestones.length > 0 && allMilestones.every((m) => m.status === "COMPLETED")

  const projectUpdate: { progress: number; status?: "SUBMITTED"; submittedAt?: Date } = {
    progress: newProgress,
  }
  if (allComplete && milestone.project.status === "IN_PROGRESS") {
    projectUpdate.status = "SUBMITTED"
    projectUpdate.submittedAt = new Date()
  }

  await db.project.update({
    where: { id: milestone.project.id },
    data: projectUpdate,
  })

  // If milestone just completed, notify the student
  // Per spec: milestone-completed student notifications link to /student/progress
  if (newStatus === "COMPLETED" && milestone.status !== "COMPLETED") {
    await db.notification.create({
      data: {
        title: "Milestone Completed",
        message: `Your milestone "${milestone.name}" was marked as completed. Project progress is now ${newProgress}%.`,
        type: "MILESTONE_COMPLETED",
        userId: milestone.project.studentId,
        link: `/student/progress`,
      },
    })
  }

  // If project just flipped to SUBMITTED, notify the student
  if (projectUpdate.status === "SUBMITTED") {
    await db.notification.create({
      data: {
        title: "Project Submitted",
        message: `All milestones for "${milestone.project.title}" are complete. Your project has been submitted for review.`,
        type: "INFO",
        userId: milestone.project.studentId,
        link: `/student/project`,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      milestone: updated,
      projectProgress: newProgress,
      projectStatus: projectUpdate.status ?? milestone.project.status,
      allMilestonesCompleted: allComplete,
    },
    message: `Milestone updated to ${newStatus.replace(/_/g, " ").toLowerCase()}. Project progress: ${newProgress}%`,
  })
}

// PUT /api/milestones/[id] — full update of a milestone (status + fields).
// SUPERVISOR only (must own the project).
// Body: { status?, name?, description?, dueDate?, order?, weight? }
// After update: recalculate project progress = sum of weights of COMPLETED
// milestones. If all milestones COMPLETED: set project.status = SUBMITTED.
// Create notification for student (type: MILESTONE_COMPLETED) when completed.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Only supervisors can update milestones" },
      { status: 403 },
    )
  }
  const { id } = await params

  let body: {
    status?: MilestoneStatus
    name?: string
    description?: string
    dueDate?: string | null
    order?: number
    weight?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const milestone = await db.milestone.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          supervisorId: true,
          studentId: true,
          progress: true,
          milestones: {
            select: { id: true, weight: true, status: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  })
  if (!milestone) {
    return NextResponse.json(
      { success: false, error: "Milestone not found" },
      { status: 404 },
    )
  }
  if (milestone.project.supervisorId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }

  // COMPLETED milestones are locked — no edits allowed at all (not even
  // date/weight changes). The supervisor UI hides the edit action for
  // completed milestones; this server-side guard makes the rule tamper-proof.
  if (milestone.status === "COMPLETED") {
    return NextResponse.json(
      {
        success: false,
        error:
          "This milestone is already completed and is locked. Completed milestones cannot be edited.",
      },
      { status: 400 },
    )
  }

  // Build updates
  const updates: {
    status?: MilestoneStatus
    name?: string
    description?: string | null
    dueDate?: Date | null
    order?: number
    weight?: number
    completedDate?: Date | null
  } = {}
  const prevStatus = milestone.status

  if (body.status) {
    if (
      !["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"].includes(
        body.status,
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      )
    }
    updates.status = body.status
    updates.completedDate =
      body.status === "COMPLETED" ? new Date() : null
  }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Name must be at least 2 characters" },
        { status: 400 },
      )
    }
    updates.name = name
  }
  if (body.description !== undefined) {
    updates.description = body.description.trim() || null
  }
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.dueDate && isNaN(updates.dueDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid dueDate" },
        { status: 400 },
      )
    }
  }
  if (body.order !== undefined) {
    if (!Number.isInteger(body.order) || body.order < 1) {
      return NextResponse.json(
        { success: false, error: "order must be a positive integer" },
        { status: 400 },
      )
    }
    updates.order = body.order
  }
  if (body.weight !== undefined) {
    if (body.weight < 1 || body.weight > 100) {
      return NextResponse.json(
        { success: false, error: "weight must be between 1 and 100" },
        { status: 400 },
      )
    }
    updates.weight = Math.round(body.weight)
  }

  const updated = await db.milestone.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      order: true,
      weight: true,
      dueDate: true,
      completedDate: true,
    },
  })

  // Recompute project progress from milestone weights
  const newStatus = updates.status ?? milestone.status
  const newWeight = updates.weight ?? milestone.project.milestones.find((m) => m.id === id)!.weight
  const allMilestones = milestone.project.milestones.map((m) =>
    m.id === id
      ? { ...m, status: newStatus, weight: newWeight }
      : m,
  )
  const totalWeight = allMilestones.reduce((s, m) => s + m.weight, 0)
  const completedWeight = allMilestones
    .filter((m) => m.status === "COMPLETED")
    .reduce((s, m) => s + m.weight, 0)
  const newProgress =
    totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : milestone.project.progress

  const allComplete =
    allMilestones.length > 0 && allMilestones.every((m) => m.status === "COMPLETED")

  const projectUpdate: { progress: number; status?: "SUBMITTED"; submittedAt?: Date } = {
    progress: newProgress,
  }
  if (allComplete && milestone.project.status === "IN_PROGRESS") {
    projectUpdate.status = "SUBMITTED"
    projectUpdate.submittedAt = new Date()
  }
  await db.project.update({
    where: { id: milestone.project.id },
    data: projectUpdate,
  })

  // Notify on completion
  // Per spec: milestone-completed student notifications link to /student/progress
  if (newStatus === "COMPLETED" && prevStatus !== "COMPLETED") {
    await db.notification.create({
      data: {
        title: "Milestone Completed",
        message: `Your milestone "${updated.name}" was marked as completed. Project progress is now ${newProgress}%.`,
        type: "MILESTONE_COMPLETED",
        userId: milestone.project.studentId,
        link: `/student/progress`,
      },
    })
  }
  if (projectUpdate.status === "SUBMITTED") {
    await db.notification.create({
      data: {
        title: "Project Submitted",
        message: `All milestones for "${milestone.project.title}" are complete. Your project has been submitted for review.`,
        type: "INFO",
        userId: milestone.project.studentId,
        link: `/student/project`,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      milestone: updated,
      projectProgress: newProgress,
      projectStatus: projectUpdate.status ?? milestone.project.status,
      allMilestonesCompleted: allComplete,
    },
    message: "Milestone updated",
  })
}
