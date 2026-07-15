import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/reports/supervisor/[id] — ADMIN or the supervisor themselves.
// Returns the supervisor's full report: profile, workload, students,
// feedbackStats, milestoneStats.
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
  if (session.user.role === "STUDENT") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    )
  }

  const { id } = await params

  // ADMIN can view any supervisor; SUPERVISOR can only view themselves
  if (session.user.role === "SUPERVISOR" && session.user.id !== id) {
    return NextResponse.json(
      { success: false, error: "You can only view your own report" },
      { status: 403 },
    )
  }

  // --- Fetch the supervisor + profile ---
  const supervisor = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      department: true,
      supervisorProfile: {
        select: {
          specialization: true,
          currentLoad: true,
          maxStudents: true,
        },
      },
    },
  })

  if (!supervisor || !supervisor.supervisorProfile) {
    return NextResponse.json(
      { success: false, error: "Supervisor not found" },
      { status: 404 },
    )
  }

  const profile = supervisor.supervisorProfile
  const current = profile.currentLoad ?? 0
  const max = profile.maxStudents ?? 5
  const utilization = max > 0 ? Math.round((current / max) * 100) : 0

  // --- Active allocations (students) ---
  const allocations = await db.allocation.findMany({
    where: { supervisorId: id, status: "ACTIVE" },
    select: {
      student: {
        select: {
          id: true,
          name: true,
          matricNo: true,
          projectsAsStudent: {
            select: {
              id: true,
              title: true,
              progress: true,
              status: true,
              updatedAt: true,
              milestones: {
                select: { id: true, status: true, dueDate: true },
              },
            },
          },
        },
      },
    },
  })

  // --- Last activity timestamps per student ---
  // For each student, gather: project.updatedAt, latest message, latest
  // feedback, latest document upload — then take the max.
  const studentRows = await Promise.all(
    allocations.map(async (alloc) => {
      const student = alloc.student
      const project = student.projectsAsStudent[0] ?? null

      // Build a list of candidate timestamps
      const ts: Date[] = []
      if (project) {
        ts.push(project.updatedAt)
        // Latest document upload
        const latestDoc = await db.document.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        if (latestDoc) ts.push(latestDoc.createdAt)

        // Latest feedback given on the project
        const latestFb = await db.feedback.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        if (latestFb) ts.push(latestFb.createdAt)
      }

      // Latest message either way
      const latestMsg = await db.message.findFirst({
        where: {
          OR: [
            { senderId: student.id, receiverId: id },
            { senderId: id, receiverId: student.id },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      if (latestMsg) ts.push(latestMsg.createdAt)

      const lastActivity = ts.length
        ? new Date(
            Math.max(...ts.map((d) => d.getTime())),
          ).toISOString()
        : null

      return {
        studentId: student.id,
        studentName: student.name,
        studentMatricNo: student.matricNo,
        projectId: project?.id ?? null,
        projectTitle: project?.title ?? null,
        progress: project?.progress ?? 0,
        status: project?.status ?? "NOT_STARTED",
        lastActivity,
      }
    }),
  )

  // --- Feedback stats (Feedback authored by this supervisor) ---
  const feedbackByStatus = await db.feedback.groupBy({
    by: ["status"],
    where: { authorId: id },
    _count: { status: true },
  })
  let totalGiven = 0
  let addressed = 0
  let pending = 0
  for (const g of feedbackByStatus) {
    totalGiven += g._count.status
    if (g.status === "ADDRESSED") addressed += g._count.status
    else if (g.status === "PENDING") pending += g._count.status
  }
  const addressedRate =
    totalGiven > 0 ? Math.round((addressed / totalGiven) * 100) : 0

  // --- Milestone stats across all this supervisor's projects ---
  const projectIds = allocations
    .map((a) => a.student.projectsAsStudent[0]?.id)
    .filter((p): p is string => !!p)

  let totalMilestones = 0
  let completedMilestones = 0
  let overdueMilestones = 0
  let sumCompletionRates = 0
  let projectCount = 0

  if (projectIds.length > 0) {
    const projects = await db.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        milestones: {
          select: { id: true, status: true, dueDate: true },
        },
      },
    })

    const now = new Date()
    for (const p of projects) {
      const t = p.milestones.length
      const c = p.milestones.filter((m) => m.status === "COMPLETED").length
      const overdue = p.milestones.filter(
        (m) =>
          m.status !== "COMPLETED" &&
          m.dueDate &&
          new Date(m.dueDate) < now,
      ).length
      totalMilestones += t
      completedMilestones += c
      overdueMilestones += overdue
      if (t > 0) {
        sumCompletionRates += Math.round((c / t) * 100)
        projectCount++
      }
    }
  }

  const avgCompletionRate =
    projectCount > 0 ? Math.round(sumCompletionRates / projectCount) : 0

  return NextResponse.json({
    success: true,
    data: {
      supervisor: {
        name: supervisor.name,
        specialization: profile.specialization,
        department: supervisor.department,
      },
      workload: {
        current,
        max,
        utilization,
      },
      students: studentRows,
      feedbackStats: {
        totalGiven,
        addressed,
        pending,
        addressedRate,
      },
      milestoneStats: {
        total: totalMilestones,
        completed: completedMilestones,
        overdue: overdueMilestones,
        avgCompletionRate,
      },
    },
  })
}
