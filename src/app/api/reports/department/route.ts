import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/reports/department — ADMIN only.
// Returns the full department report: summary, progressDistribution,
// supervisorPerformance, milestoneCompletion, topicApprovalRate.
// Query params `academicYear` and `semester` are accepted but optional
// (filtering is a no-op for now — we return all-time data when omitted).
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const academicYear = url.searchParams.get("academicYear") || undefined
  const semester = url.searchParams.get("semester") || undefined

  // Optional allocation filter (only applied if both year + semester provided)
  const allocationWhere: {
    academicYear?: string
    semester?: string
    status?: "ACTIVE"
  } = { status: "ACTIVE" }
  if (academicYear) allocationWhere.academicYear = academicYear
  if (semester) allocationWhere.semester = semester

  // --- Summary counts ---
  const [
    totalStudents,
    totalSupervisors,
    totalProjects,
    projectProgressAgg,
    approvedProjects,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", isActive: true } }),
    db.user.count({ where: { role: "SUPERVISOR", isActive: true } }),
    db.project.count(),
    db.project.aggregate({ _avg: { progress: true } }),
    db.project.count({ where: { status: "APPROVED" } }),
  ])

  const avgProgress = projectProgressAgg._avg.progress
    ? Math.round(projectProgressAgg._avg.progress)
    : 0
  const completionRate =
    totalProjects > 0
      ? Math.round((approvedProjects / totalProjects) * 100)
      : 0

  // --- Progress distribution (5 buckets) ---
  const allProjects = await db.project.findMany({
    select: { progress: true },
  })
  const ranges = [
    { range: "0-20%", min: 0, max: 20, count: 0 },
    { range: "21-40%", min: 21, max: 40, count: 0 },
    { range: "41-60%", min: 41, max: 60, count: 0 },
    { range: "61-80%", min: 61, max: 80, count: 0 },
    { range: "81-100%", min: 81, max: 100, count: 0 },
  ]
  for (const p of allProjects) {
    const v = Math.min(100, Math.max(0, p.progress))
    const idx = Math.min(4, Math.floor(v / 20))
    ranges[idx].count++
  }

  // --- Supervisor performance ---
  const supervisors = await db.user.findMany({
    where: { role: "SUPERVISOR", isActive: true },
    select: {
      id: true,
      name: true,
      supervisorProfile: { select: { specialization: true } },
      supervisorAllocation: {
        where: allocationWhere,
        select: { studentId: true },
      },
    },
  })

  const supervisorPerformance = await Promise.all(
    supervisors.map(async (sup) => {
      const studentIds = sup.supervisorAllocation.map((a) => a.studentId)
      const totalStudentsForSup = studentIds.length

      let avgProgressSup = 0
      let completedProjects = 0
      let activeProjects = 0
      if (studentIds.length > 0) {
        const [agg, statusCounts] = await Promise.all([
          db.project.aggregate({
            where: { studentId: { in: studentIds } },
            _avg: { progress: true },
          }),
          db.project.groupBy({
            by: ["status"],
            where: { studentId: { in: studentIds } },
            _count: { status: true },
          }),
        ])
        avgProgressSup = agg._avg.progress ? Math.round(agg._avg.progress) : 0
        for (const g of statusCounts) {
          if (g.status === "APPROVED") completedProjects += g._count.status
          else if (g.status === "IN_PROGRESS") activeProjects += g._count.status
        }
      }

      return {
        supervisorId: sup.id,
        name: sup.name,
        specialization: sup.supervisorProfile?.specialization ?? null,
        totalStudents: totalStudentsForSup,
        avgProgress: avgProgressSup,
        completedProjects,
        activeProjects,
      }
    }),
  )

  // --- Milestone completion (group by name) ---
  const milestoneGroups = await db.milestone.groupBy({
    by: ["name", "status"],
    _count: { status: true },
  })
  const milestoneMap = new Map<
    string,
    { total: number; completed: number }
  >()
  for (const m of milestoneGroups) {
    const entry = milestoneMap.get(m.name) ?? { total: 0, completed: 0 }
    entry.total += m._count.status
    if (m.status === "COMPLETED") entry.completed += m._count.status
    milestoneMap.set(m.name, entry)
  }

  // Preserve the canonical milestone ordering from the seed data
  const canonicalOrder = [
    "Topic Approval",
    "Proposal Submission",
    "Literature Review",
    "Data Collection",
    "Final Report",
  ]
  const milestoneCompletion = Array.from(milestoneMap.entries())
    .map(([name, counts]) => ({
      milestoneName: name,
      totalAssigned: counts.total,
      completed: counts.completed,
      completionRate:
        counts.total > 0
          ? Math.round((counts.completed / counts.total) * 100)
          : 0,
    }))
    .sort((a, b) => {
      const aIdx = canonicalOrder.findIndex((n) =>
        a.milestoneName.toLowerCase().startsWith(n.toLowerCase()),
      )
      const bIdx = canonicalOrder.findIndex((n) =>
        b.milestoneName.toLowerCase().startsWith(n.toLowerCase()),
      )
      const ai = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
      const bi = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
      if (ai !== bi) return ai - bi
      return a.milestoneName.localeCompare(b.milestoneName)
    })

  // --- Topic approval rate ---
  const topicStatusGroups = await db.topic.groupBy({
    by: ["status"],
    _count: { status: true },
  })
  const topicCounts: Record<string, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    REVISION_REQUIRED: 0,
  }
  for (const g of topicStatusGroups) {
    topicCounts[g.status] = g._count.status
  }
  const submitted =
    topicCounts.PENDING +
    topicCounts.APPROVED +
    topicCounts.REJECTED +
    topicCounts.REVISION_REQUIRED
  const approvalRate =
    submitted > 0
      ? Math.round((topicCounts.APPROVED / submitted) * 100)
      : 0

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalStudents,
        totalSupervisors,
        totalProjects,
        avgProgress,
        completionRate,
      },
      progressDistribution: ranges,
      supervisorPerformance,
      milestoneCompletion,
      topicApprovalRate: {
        submitted,
        approved: topicCounts.APPROVED,
        rejected: topicCounts.REJECTED,
        revisionRequested: topicCounts.REVISION_REQUIRED,
        pending: topicCounts.PENDING,
        approvalRate,
      },
    },
  })
}
