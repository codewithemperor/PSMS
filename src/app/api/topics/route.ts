import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// GET /api/topics — role-filtered list
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const search = url.searchParams.get("search")?.trim() ?? ""
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)),
  )

  const where: Prisma.TopicWhereInput = {}

  // Role-based scoping
  if (session.user.role === "SUPERVISOR") {
    where.supervisorId = session.user.id
  } else if (session.user.role === "STUDENT") {
    where.studentId = session.user.id
  }
  // ADMIN sees all

  if (status && ["PENDING", "APPROVED", "REJECTED", "REVISION_REQUIRED"].includes(status)) {
    where.status = status as Prisma.TopicWhereInput["status"]
  }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ]
  }

  const [total, topics] = await Promise.all([
    db.topic.count({ where }),
    db.topic.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            matricNo: true,
            department: true,
          },
        },
        supervisor: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    }),
  ])

  // Counts by status (for filter pills)
  const statusCountsRaw = await db.topic.groupBy({
    by: ["status"],
    _count: { status: true },
    where:
      session.user.role === "SUPERVISOR"
        ? { supervisorId: session.user.id }
        : session.user.role === "STUDENT"
          ? { studentId: session.user.id }
          : undefined,
  })
  const statusCounts: Record<string, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    REVISION_REQUIRED: 0,
  }
  statusCountsRaw.forEach((g) => {
    statusCounts[g.status] = g._count.status
  })

  const data = topics.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    studentId: t.studentId,
    studentName: t.student.name,
    studentEmail: t.student.email,
    studentMatricNo: t.student.matricNo,
    studentDepartment: t.student.department,
    supervisorId: t.supervisorId,
    supervisorName: t.supervisor.name,
    projectId: t.projectId,
    status: t.status,
    submittedAt: t.submittedAt,
    reviewedAt: t.reviewedAt,
    reviewerComment: t.reviewerComment,
  }))

  return NextResponse.json({
    success: true,
    data,
    statusCounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
}

// POST /api/topics — student submits a new topic for approval
// Body: { title, description, supervisorId? }
// Supervisor resolution (when supervisorId omitted):
//   1) student's active Allocation
//   2) auto-pick the lowest-load supervisor with capacity (currentLoad < maxStudents)
// Response data includes the resolved supervisorName so the UI can show it.
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
      { success: false, error: "Only students can submit topics" },
      { status: 403 },
    )
  }
  const studentId = session.user.id

  let body: { title?: string; description?: string; supervisorId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const title = body.title?.trim()
  const description = body.description?.trim()
  if (!title || title.length < 5) {
    return NextResponse.json(
      { success: false, error: "Title must be at least 5 characters" },
      { status: 400 },
    )
  }
  if (!description || description.length < 20) {
    return NextResponse.json(
      { success: false, error: "Description must be at least 20 characters" },
      { status: 400 },
    )
  }

  // --- Supervisor resolution ---
  // Priority: explicit body.supervisorId → student's active Allocation →
  // auto-pick the lowest-load supervisor that still has capacity.
  // The frontend no longer sends a supervisorId, so the allocation +
  // auto-pick paths are the primary paths.
  let supervisor: { id: string; name: string } | null = null

  // 1. Explicit supervisorId (kept for API backwards-compat)
  if (body.supervisorId) {
    supervisor = await db.user.findFirst({
      where: { id: body.supervisorId, role: "SUPERVISOR", isActive: true },
      select: { id: true, name: true },
    })
    if (!supervisor) {
      return NextResponse.json(
        { success: false, error: "Selected supervisor not found" },
        { status: 404 },
      )
    }
  }

  // 2. Student's active allocation
  if (!supervisor) {
    const alloc = await db.allocation.findFirst({
      where: { studentId, status: "ACTIVE" },
      select: { supervisorId: true },
    })
    if (alloc?.supervisorId) {
      supervisor = await db.user.findFirst({
        where: { id: alloc.supervisorId, role: "SUPERVISOR", isActive: true },
        select: { id: true, name: true },
      })
    }
  }

  // 3. Auto-pick: lowest currentLoad among active supervisors with capacity
  //    (currentLoad < maxStudents). Prisma cannot compare two columns, so we
  //    fetch candidates ordered by currentLoad ASC and pick the first eligible.
  if (!supervisor) {
    const candidates = await db.user.findMany({
      where: {
        role: "SUPERVISOR",
        isActive: true,
        supervisorProfile: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        supervisorProfile: { select: { currentLoad: true, maxStudents: true } },
      },
      orderBy: { supervisorProfile: { currentLoad: "asc" } },
    })
    const picked = candidates.find(
      (c) =>
        !!c.supervisorProfile &&
        c.supervisorProfile.currentLoad < c.supervisorProfile.maxStudents,
    )
    if (picked) {
      supervisor = { id: picked.id, name: picked.name }
    }
  }

  // 4. No supervisor available — all at capacity
  if (!supervisor) {
    return NextResponse.json(
      {
        success: false,
        error:
          "All supervisors are at full capacity. Please contact your administrator.",
      },
      { status: 400 },
    )
  }

  const supervisorId = supervisor.id
  const supervisorName = supervisor.name

  // Prevent duplicate / parallel topic submissions.
  // Rule: a student can only have ONE active project at a time.
  //   - If they have a PENDING topic → must wait for it to be reviewed.
  //   - If they have an APPROVED topic → a project already exists; no new
  //     topic allowed (the project would have to be deleted first).
  //   - REJECTED or REVISION_REQUIRED topics do NOT block a new submission
  //     (the student is expected to revise & resubmit).
  const blockingTopic = await db.topic.findFirst({
    where: {
      studentId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true, status: true, title: true },
    orderBy: { submittedAt: "desc" },
  })
  if (blockingTopic) {
    const reason =
      blockingTopic.status === "PENDING"
        ? "You already have a topic pending review. Please wait for your supervisor to review it before submitting a new one."
        : "Your topic has already been approved and a project has been created for you. You cannot submit a new topic while you have an active project."
    return NextResponse.json(
      {
        success: false,
        error: reason,
      },
      { status: 409 },
    )
  }

  const topic = await db.topic.create({
    data: {
      title,
      description,
      studentId,
      supervisorId,
      status: "PENDING",
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      submittedAt: true,
    },
  })

  // Notify supervisor + all admins
  await db.notification.create({
    data: {
      title: "New Topic Submitted",
      message: `${session.user.name ?? "A student"} submitted a new topic: "${title}"`,
      type: "TOPIC_SUBMITTED",
      userId: supervisorId,
      link: "/supervisor/topics",
    },
  })
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  })
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        title: "New Topic Submitted",
        message: `${session.user.name ?? "A student"} submitted a new topic: "${title}"`,
        type: "TOPIC_SUBMITTED",
        userId: a.id,
        link: "/admin/topics",
      })),
    })
  }

  return NextResponse.json(
    {
      success: true,
      data: { ...topic, supervisorName },
      message: "Topic submitted. Your supervisor will review it.",
    },
    { status: 201 },
  )
}
