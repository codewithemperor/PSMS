import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// Helper: convert Prisma groupBy result to a complete distribution array
function fillStatusDistribution<T extends string>(
  groups: { status: T; _count: { status: number } }[],
  statuses: T[],
): { status: T; count: number }[] {
  return statuses.map((status) => ({
    status,
    count: groups.find((g) => g.status === status)?._count.status ?? 0,
  }))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  // --- Counts (parallel) ---
  const [
    totalStudents,
    totalSupervisors,
    totalProjects,
    projectsInProgress,
    projectsCompleted,
    pendingTopics,
    overdueMilestones,
    totalDocuments,
    totalFeedback,
    activeAllocations,
    projectStatusGroups,
    projectProgressAgg,
    recentActivities,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "SUPERVISOR" } }),
    db.project.count(),
    db.project.count({ where: { status: "IN_PROGRESS" } }),
    db.project.count({ where: { status: "APPROVED" } }),
    db.topic.count({ where: { status: "PENDING" } }),
    db.milestone.count({
      where: {
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    }),
    db.document.count(),
    db.feedback.count(),
    db.allocation.count({ where: { status: "ACTIVE" } }),
    db.project.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.project.aggregate({ _avg: { progress: true } }),
    db.notification.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, role: true } } },
    }),
  ])

  const averageProgress = projectProgressAgg._avg.progress
    ? Math.round(projectProgressAgg._avg.progress)
    : 0

  // --- Project status distribution (full 5-state list) ---
  const projectStatusDistribution = fillStatusDistribution(projectStatusGroups, [
    "NOT_STARTED",
    "IN_PROGRESS",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
  ] as const)

  // --- Supervisor workload ---
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

  // For each supervisor, fetch average progress of their students' projects
  const supervisorWorkload = await Promise.all(
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
        maxStudents: sup.supervisorProfile?.maxStudents ?? 5,
        avgProgress,
      }
    }),
  )

  return NextResponse.json({
    success: true,
    data: {
      totalStudents,
      totalSupervisors,
      totalProjects,
      projectsInProgress,
      projectsCompleted,
      pendingTopics,
      overdueMilestones,
      totalDocuments,
      totalFeedback,
      activeAllocations,
      averageProgress,
      projectStatusDistribution,
      supervisorWorkload,
      recentActivities: recentActivities.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: n.createdAt,
        userName: n.user?.name ?? "System",
        userRole: n.user?.role ?? null,
      })),
    },
  })
}
