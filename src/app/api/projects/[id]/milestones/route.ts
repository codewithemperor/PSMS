import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { MilestoneStatus } from "@prisma/client"

// GET /api/projects/[id]/milestones — list milestones for a project, ordered.
// Access: SUPERVISOR (must own), ADMIN, or STUDENT (must own project).
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
      supervisorId: true,
      studentId: true,
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
    },
  })

  if (!project) {
    return NextResponse.json(
      { success: false, error: "Project not found" },
      { status: 404 },
    )
  }

  if (
    (session.user.role === "SUPERVISOR" &&
      project.supervisorId !== session.user.id) ||
    (session.user.role === "STUDENT" &&
      project.studentId !== session.user.id)
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }

  return NextResponse.json({
    success: true,
    data: project.milestones,
  })
}

// POST /api/projects/[id]/milestones — create a new milestone.
// SUPERVISOR only (must own the project).
// Body: { name, description?, dueDate?, order, weight }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Only supervisors can create milestones" },
      { status: 403 },
    )
  }
  const { id } = await params

  let body: {
    name?: string
    description?: string
    dueDate?: string
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

  const name = body.name?.trim()
  if (!name || name.length < 2) {
    return NextResponse.json(
      { success: false, error: "Milestone name is required (min 2 chars)" },
      { status: 400 },
    )
  }
  const order =
    typeof body.order === "number" && body.order > 0
      ? Math.floor(body.order)
      : null
  if (order === null) {
    return NextResponse.json(
      { success: false, error: "order must be a positive integer" },
      { status: 400 },
    )
  }
  const weight =
    typeof body.weight === "number" && body.weight >= 1 && body.weight <= 100
      ? Math.round(body.weight)
      : null
  if (weight === null) {
    return NextResponse.json(
      { success: false, error: "weight must be between 1 and 100" },
      { status: 400 },
    )
  }
  let dueDate: Date | null = null
  if (body.dueDate) {
    dueDate = new Date(body.dueDate)
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid dueDate" },
        { status: 400 },
      )
    }
  }

  // Verify project + ownership
  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      supervisorId: true,
      studentId: true,
      _count: { select: { milestones: true } },
    },
  })
  if (!project) {
    return NextResponse.json(
      { success: false, error: "Project not found" },
      { status: 404 },
    )
  }
  if (project.supervisorId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You are not the supervisor of this project" },
      { status: 403 },
    )
  }

  const milestone = await db.milestone.create({
    data: {
      name,
      description: body.description?.trim() || null,
      dueDate,
      order,
      weight,
      status: "NOT_STARTED" as MilestoneStatus,
      projectId: id,
    },
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
  })

  // Notify the student
  await db.notification.create({
    data: {
      title: "New Milestone Added",
      message: `A new milestone "${name}" was added to your project "${project.title}".`,
      type: "MILESTONE_DUE",
      userId: project.studentId,
      link: `/student/project`,
    },
  })

  return NextResponse.json(
    {
      success: true,
      data: milestone,
      message: "Milestone created",
    },
    { status: 201 },
  )
}
