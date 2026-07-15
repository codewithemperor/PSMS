import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma, ProjectStatus } from "@prisma/client"

// GET /api/projects — ADMIN-only list of all projects (paginated, filterable).
//
// Query params:
//   status        — ProjectStatus enum value (NOT_STARTED | IN_PROGRESS |
//                   SUBMITTED | APPROVED | REJECTED)
//   supervisorId  — filter by supervisor
//   search        — case-insensitive contains on project title / description /
//                   student name / matricNo / supervisor name
//   page          — 1-based page number (default 1)
//   limit         — page size (default 12, capped at 100)
//
// Returns:
//   { success, data: ProjectRow[], statusCounts, pagination }
// where each ProjectRow carries student + supervisor + _count +
// milestoneStats { completed, total }.
export async function GET(request: Request) {
  // --- Auth: ADMIN-only ---
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden — admin access required",
      },
      { status: 403 },
    )
  }

  // --- Parse query ---
  const url = new URL(request.url)
  const validStatuses: ProjectStatus[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
  ]
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && validStatuses.includes(statusParam as ProjectStatus)
      ? (statusParam as ProjectStatus)
      : undefined
  const supervisorId = url.searchParams.get("supervisorId") || undefined
  const search = url.searchParams.get("search")?.trim() ?? ""
  const page = Math.max(
    1,
    parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
  )
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "12", 10) || 12),
  )

  // --- Build where ---
  const where: Prisma.ProjectWhereInput = {}
  if (status) where.status = status
  if (supervisorId) where.supervisorId = supervisorId
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { student: { name: { contains: search } } },
      { student: { matricNo: { contains: search } } },
      { supervisor: { name: { contains: search } } },
    ]
  }

  // --- Parallel: paginated rows + total + status counts ---
  const [rawProjects, total, statusGroups] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
          },
        },
        supervisor: {
          select: { id: true, name: true },
        },
        // Lightweight milestone payload — used for the per-card stat only.
        milestones: {
          select: { id: true, status: true },
          orderBy: { order: "asc" },
        },
        _count: {
          select: { documents: true, feedback: true, milestones: true },
        },
      },
    }),
    db.project.count({ where }),
    db.project.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ])

  // --- Shape project rows ---
  const data = rawProjects.map((p) => {
    const milestoneTotal = p._count.milestones
    const milestoneCompleted = p.milestones.filter(
      (m) => m.status === "COMPLETED",
    ).length
    // Strip the raw milestones array — it was only needed for the count.
    const { milestones, ...rest } = p
    return {
      ...rest,
      student: p.student,
      supervisor: p.supervisor,
      _count: {
        milestones: p._count.milestones,
        documents: p._count.documents,
        feedback: p._count.feedback,
      },
      milestoneStats: {
        total: milestoneTotal,
        completed: milestoneCompleted,
      },
    }
  })

  // --- Shape status counts (always include all 5 statuses, even if 0) ---
  const statusCounts: Record<ProjectStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  for (const g of statusGroups) {
    statusCounts[g.status] = g._count._all
  }

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
