import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/supervisors/[id]/students — paginated list of a supervisor's
// allocated students with project progress + last activity.
// Access: SUPERVISOR (only their own ID) or ADMIN (any supervisor).
// Query: status (project status filter), search, sortBy
//   (progress_asc | progress_desc | name | lastActivity), page, limit
export async function GET(
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
  const { id: supervisorId } = await params

  // Role guard: supervisor may only query their own ID; admin may query any
  if (session.user.role === "SUPERVISOR" && session.user.id !== supervisorId) {
    return NextResponse.json(
      { success: false, error: "You can only view your own students" },
      { status: 403 },
    )
  }
  if (
    session.user.role !== "SUPERVISOR" &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }

  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const statusFilter = url.searchParams.get("status") ?? "all"
  const sortBy = url.searchParams.get("sortBy") ?? "progress_desc"
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
  )

  // Active allocations for this supervisor
  const allocations = await db.allocation.findMany({
    where: { supervisorId, status: "ACTIVE" },
    select: {
      studentId: true,
      academicYear: true,
      semester: true,
      allocatedAt: true,
    },
    orderBy: { allocatedAt: "desc" },
  })
  const studentIds = allocations.map((a) => a.studentId)

  if (studentIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    })
  }

  // Students with profile + project + last feedback/doc
  const students = await db.user.findMany({
    where: {
      id: { in: studentIds },
      role: "STUDENT",
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { matricNo: { contains: search } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      matricNo: true,
      department: true,
      avatar: true,
      studentProfile: {
        select: { level: true, programme: true, enrollmentYear: true },
      },
      projectsAsStudent: {
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          updatedAt: true,
          startDate: true,
          expectedEndDate: true,
          milestones: {
            select: {
              id: true,
              name: true,
              status: true,
              order: true,
              dueDate: true,
            },
            orderBy: { order: "asc" },
          },
        },
        take: 1,
      },
      receivedFeedback: {
        select: { id: true, createdAt: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      uploadedDocuments: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  // Merge allocation meta + compute lastActivity + apply status filter
  const allocMap = new Map(allocations.map((a) => [a.studentId, a]))
  const rows = students
    .map((s) => {
      const alloc = allocMap.get(s.id)
      const project = s.projectsAsStudent[0] ?? null
      const lastFeedback = s.receivedFeedback[0] ?? null
      const lastDocument = s.uploadedDocuments[0] ?? null
      const lastActivity = [
        project?.updatedAt ?? null,
        lastFeedback?.createdAt ?? null,
        lastDocument?.createdAt ?? null,
      ]
        .filter(Boolean)
        .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]

      return {
        studentId: s.id,
        studentName: s.name,
        studentEmail: s.email,
        studentMatricNo: s.matricNo ?? "",
        studentDepartment: s.department ?? "",
        studentAvatar: s.avatar,
        level: s.studentProfile?.level ?? null,
        programme: s.studentProfile?.programme ?? null,
        allocation: alloc
          ? {
              academicYear: alloc.academicYear,
              semester: alloc.semester,
              allocatedAt: alloc.allocatedAt,
            }
          : null,
        projectId: project?.id ?? null,
        projectTitle: project?.title ?? null,
        projectStatus: project?.status ?? null,
        projectProgress: project?.progress ?? 0,
        projectUpdatedAt: project?.updatedAt ?? null,
        totalMilestones: project?.milestones.length ?? 0,
        completedMilestones:
          project?.milestones.filter((m) => m.status === "COMPLETED")
            .length ?? 0,
        currentMilestone:
          project?.milestones.find(
            (m) => m.status === "IN_PROGRESS" || m.status === "NOT_STARTED",
          ) ?? null,
        lastActivity: lastActivity ?? null,
        lastFeedbackAt: lastFeedback?.createdAt ?? null,
        lastFeedbackStatus: lastFeedback?.status ?? null,
        lastDocumentAt: lastDocument?.createdAt ?? null,
      }
    })
    // Apply project status filter
    .filter((r) => {
      if (!statusFilter || statusFilter === "all") return true
      if (statusFilter === "NO_PROJECT") return !r.projectId
      return r.projectStatus === statusFilter
    })

  // Sorting
  rows.sort((a, b) => {
    switch (sortBy) {
      case "progress_asc":
        return a.projectProgress - b.projectProgress
      case "name":
        return a.studentName.localeCompare(b.studentName)
      case "lastActivity": {
        const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        return tb - ta
      }
      case "progress_desc":
      default:
        return b.projectProgress - a.projectProgress
    }
  })

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const paged = rows.slice((page - 1) * limit, page * limit)

  return NextResponse.json({
    success: true,
    data: paged,
    pagination: { total, page, limit, totalPages },
  })
}
