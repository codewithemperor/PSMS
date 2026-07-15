import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/supervisor/students — list of allocated students with project progress
// Supervisor-only. Returns each student's profile + project + current milestone.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const supervisorId = session.user.id

  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""

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
    return NextResponse.json({ success: true, data: [] })
  }

  // Students with profile + project + last feedback
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
          expectedEndDate: true,
          startDate: true,
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
    orderBy: { name: "asc" },
  })

  // Merge in allocation meta
  const allocMap = new Map(allocations.map((a) => [a.studentId, a]))
  const data = students.map((s) => {
    const alloc = allocMap.get(s.id)
    const project = s.projectsAsStudent[0] ?? null
    const currentMilestone = project?.milestones.find(
      (m) => m.status === "IN_PROGRESS" || m.status === "NOT_STARTED",
    )
    const lastFeedback = s.receivedFeedback[0] ?? null
    const lastDocument = s.uploadedDocuments[0] ?? null
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      matricNo: s.matricNo,
      department: s.department,
      avatar: s.avatar,
      level: s.studentProfile?.level ?? null,
      programme: s.studentProfile?.programme ?? null,
      enrollmentYear: s.studentProfile?.enrollmentYear ?? null,
      allocation: alloc
        ? {
            academicYear: alloc.academicYear,
            semester: alloc.semester,
            allocatedAt: alloc.allocatedAt,
          }
        : null,
      project: project
        ? {
            id: project.id,
            title: project.title,
            status: project.status,
            progress: project.progress,
            startDate: project.startDate,
            expectedEndDate: project.expectedEndDate,
            totalMilestones: project.milestones.length,
            completedMilestones: project.milestones.filter(
              (m) => m.status === "COMPLETED",
            ).length,
            currentMilestone: currentMilestone
              ? {
                  id: currentMilestone.id,
                  name: currentMilestone.name,
                  status: currentMilestone.status,
                  dueDate: currentMilestone.dueDate,
                }
              : null,
          }
        : null,
      lastFeedbackAt: lastFeedback?.createdAt ?? null,
      lastFeedbackStatus: lastFeedback?.status ?? null,
      lastDocumentAt: lastDocument?.createdAt ?? null,
    }
  })

  return NextResponse.json({ success: true, data })
}
