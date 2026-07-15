import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/reports/students — ADMIN only.
// Returns a flat list of all students with their supervisor + project info,
// milestones progress, and last-activity timestamp.
// Used by the Student Progress tab of System Reports.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  // All active students with their active allocation + supervisor + project
  const students = await db.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: {
      id: true,
      name: true,
      matricNo: true,
      studentProfile: { select: { supervisorId: true } },
      studentAllocation: {
        where: { status: "ACTIVE" },
        select: {
          supervisorId: true,
          supervisor: { select: { id: true, name: true } },
        },
        take: 1,
      },
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
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  })

  const now = new Date()

  // Compute last activity per student in parallel
  const rows = await Promise.all(
    students.map(async (s) => {
      const project = s.projectsAsStudent[0] ?? null
      const allocation = s.studentAllocation[0] ?? null
      const supervisor = allocation?.supervisor ?? null

      const ts: Date[] = []
      if (project) {
        ts.push(project.updatedAt)
        const latestDoc = await db.document.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        if (latestDoc) ts.push(latestDoc.createdAt)

        const latestFb = await db.feedback.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        if (latestFb) ts.push(latestFb.createdAt)
      }

      // Latest message with their supervisor (if any)
      if (supervisor) {
        const latestMsg = await db.message.findFirst({
          where: {
            OR: [
              { senderId: s.id, receiverId: supervisor.id },
              { senderId: supervisor.id, receiverId: s.id },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        if (latestMsg) ts.push(latestMsg.createdAt)
      }

      const lastActivity = ts.length
        ? new Date(Math.max(...ts.map((d) => d.getTime()))).toISOString()
        : null

      const milestonesTotal = project?.milestones.length ?? 0
      const milestonesCompleted =
        project?.milestones.filter((m) => m.status === "COMPLETED").length ?? 0
      // overdue: any non-completed milestone whose dueDate < now
      const milestonesOverdue =
        project?.milestones.filter(
          (m) =>
            m.status !== "COMPLETED" && m.dueDate && new Date(m.dueDate) < now,
        ).length ?? 0

      return {
        studentId: s.id,
        studentName: s.name,
        studentMatricNo: s.matricNo,
        supervisorId: supervisor?.id ?? null,
        supervisorName: supervisor?.name ?? null,
        projectId: project?.id ?? null,
        projectTitle: project?.title ?? null,
        progress: project?.progress ?? 0,
        status: project?.status ?? "NOT_STARTED",
        milestonesTotal,
        milestonesCompleted,
        milestonesOverdue,
        lastActivity,
      }
    }),
  )

  return NextResponse.json({
    success: true,
    data: rows,
  })
}
