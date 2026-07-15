import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/stats — public summary of system totals (safe to expose)
// Used by the root status page + any visitor-facing dashboard.
// Authed users get a richer payload (role-aware counts).
export async function GET() {
  const session = await getServerSession(authOptions)

  const [
    totalUsers,
    totalStudents,
    totalSupervisors,
    totalAdmins,
    totalProjects,
    totalTopics,
    totalDocuments,
    totalMilestones,
    totalFeedback,
    totalAllocations,
    pendingTopics,
    activeProjects,
    completedMilestones,
    overdueMilestones,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "SUPERVISOR" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.project.count(),
    db.topic.count(),
    db.document.count(),
    db.milestone.count(),
    db.feedback.count(),
    db.allocation.count({ where: { status: "ACTIVE" } }),
    db.topic.count({ where: { status: "PENDING" } }),
    db.project.count({ where: { status: "IN_PROGRESS" } }),
    db.milestone.count({ where: { status: "COMPLETED" } }),
    db.milestone.count({ where: { status: "OVERDUE" } }),
  ])

  // Role-scoped extras for authed users
  let scoped: Record<string, unknown> = {}
  if (session?.user) {
    if (session.user.role === "STUDENT") {
      const myProject = await db.project.findUnique({
        where: { studentId: session.user.id },
        select: { progress: true, status: true },
      })
      scoped = {
        myProjectProgress: myProject?.progress ?? 0,
        myProjectStatus: myProject?.status ?? null,
      }
    } else if (session.user.role === "SUPERVISOR") {
      // Use active allocations as the single source of truth so the
      // "myStudents" and "myProjects" counts always agree. Filtering
      // projects by Project.supervisorId can drift stale when a student
      // is reassigned via the revoke endpoint without a same-transaction
      // reassign, which previously caused mismatches like "4 active
      // projects but only 2 students".
      const myStudentAllocs = await db.allocation.findMany({
        where: { supervisorId: session.user.id, status: "ACTIVE" },
        select: { studentId: true },
      })
      const myStudentIds = myStudentAllocs.map((a) => a.studentId)
      const myStudents = myStudentIds.length
      const myProjects = await db.project.count({
        where: myStudentIds.length
          ? { studentId: { in: myStudentIds } }
          : { id: "__none__" },
      })
      const myPendingTopics = await db.topic.count({
        where: { supervisorId: session.user.id, status: "PENDING" },
      })
      scoped = { myStudents, myProjects, myPendingTopics }
    } else if (session.user.role === "ADMIN") {
      scoped = { isAdmin: true }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        students: totalStudents,
        supervisors: totalSupervisors,
        admins: totalAdmins,
      },
      projects: totalProjects,
      activeProjects,
      topics: totalTopics,
      pendingTopics,
      documents: totalDocuments,
      milestones: {
        total: totalMilestones,
        completed: completedMilestones,
        overdue: overdueMilestones,
      },
      feedback: totalFeedback,
      activeAllocations: totalAllocations,
      ...scoped,
    },
    timestamp: new Date().toISOString(),
  })
}
