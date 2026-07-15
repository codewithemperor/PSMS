import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/dashboard/overview — admin-only department-wide analytics
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  // --- Summary counts ---
  const [
    enrolledStudents,
    activeSupervisors,
    totalProjects,
    projectProgressAgg,
    atRiskProjects,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", isActive: true } }),
    db.user.count({ where: { role: "SUPERVISOR", isActive: true } }),
    db.project.count(),
    db.project.aggregate({ _avg: { progress: true } }),
    db.project.count({ where: { progress: { lt: 30 } } }),
  ])

  const averageProgress = projectProgressAgg._avg.progress
    ? Math.round(projectProgressAgg._avg.progress)
    : 0

  // --- Project progress table rows ---
  const projects = await db.project.findMany({
    orderBy: { progress: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      progress: true,
      startDate: true,
      expectedEndDate: true,
      student: { select: { id: true, name: true, matricNo: true } },
      supervisor: { select: { id: true, name: true } },
    },
  })

  const projectRows = projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    progress: p.progress,
    startDate: p.startDate,
    expectedEndDate: p.expectedEndDate,
    studentId: p.student.id,
    studentName: p.student.name,
    studentMatricNo: p.student.matricNo,
    supervisorId: p.supervisor.id,
    supervisorName: p.supervisor.name,
  }))

  // --- Supervisor performance (avg progress + student count) ---
  const supervisors = await db.user.findMany({
    where: { role: "SUPERVISOR", isActive: true },
    select: {
      id: true,
      name: true,
      supervisorProfile: {
        select: { currentLoad: true, maxStudents: true, specialization: true },
      },
      supervisorAllocation: {
        where: { status: "ACTIVE" },
        select: { studentId: true },
      },
    },
  })

  const supervisorPerformance = await Promise.all(
    supervisors.map(async (sup) => {
      const studentIds = sup.supervisorAllocation.map((a) => a.studentId)
      let avgProgress = 0
      if (studentIds.length > 0) {
        const projectsAgg = await db.project.aggregate({
          where: { studentId: { in: studentIds } },
          _avg: { progress: true },
        })
        avgProgress = projectsAgg._avg.progress
          ? Math.round(projectsAgg._avg.progress)
          : 0
      }
      return {
        supervisorId: sup.id,
        name: sup.name,
        specialization: sup.supervisorProfile?.specialization ?? null,
        studentCount: sup.supervisorAllocation.length,
        avgProgress,
      }
    }),
  )

  // --- Milestone completion rates (across all projects) ---
  const milestones = await db.milestone.groupBy({
    by: ["name", "status"],
    _count: { status: true },
  })

  // Aggregate by milestone name
  const milestoneMap = new Map<
    string,
    { total: number; completed: number }
  >()
  for (const m of milestones) {
    const entry = milestoneMap.get(m.name) ?? { total: 0, completed: 0 }
    entry.total += m._count.status
    if (m.status === "COMPLETED") entry.completed += m._count.status
    milestoneMap.set(m.name, entry)
  }

  const milestoneCompletion = Array.from(milestoneMap.entries()).map(
    ([name, counts]) => ({
      name,
      total: counts.total,
      completed: counts.completed,
      completionRate:
        counts.total > 0
          ? Math.round((counts.completed / counts.total) * 100)
          : 0,
    }),
  )

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        enrolledStudents,
        activeSupervisors,
        totalProjects,
        averageProgress,
        atRiskProjects,
      },
      projectRows,
      supervisorPerformance,
      milestoneCompletion,
    },
  })
}
