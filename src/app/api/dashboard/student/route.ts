import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/dashboard/student — student's personalized dashboard data
// Returns: project (with milestones, topics, documents, feedback), pending
// feedback count, unread notifications, milestone status breakdown, document
// type distribution, and recent activities.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const studentId = session.user.id

  const project = await db.project.findUnique({
    where: { studentId },
    include: {
      supervisor: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          supervisorProfile: {
            select: { specialization: true },
          },
        },
      },
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          order: true,
          weight: true,
          dueDate: true,
          completedDate: true,
          description: true,
        },
      },
      topics: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewerComment: true,
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          fileName: true,
          documentType: true,
          createdAt: true,
          fileSize: true,
        },
      },
      feedback: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          author: { select: { id: true, name: true } },
          document: { select: { id: true, title: true } },
        },
      },
    },
  })

  // Even when the student has no Project yet, they may have a pending /
  // rejected / revision-required Topic. We surface the latest topic (with
  // the assigned supervisor) so the UI can render a state-aware "topic
  // under review" panel instead of a generic "No project yet" empty state.
  let latestTopic: {
    id: string
    title: string
    description: string
    status: string
    submittedAt: string
    reviewedAt: string | null
    reviewerComment: string | null
    supervisor: {
      id: string
      name: string
      email: string
      department: string | null
      supervisorProfile: { specialization: string | null } | null
    }
  } | null = null
  if (!project) {
    const t = await db.topic.findFirst({
      where: { studentId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewerComment: true,
        supervisor: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            supervisorProfile: { select: { specialization: true } },
          },
        },
      },
    })
    if (t) {
      latestTopic = {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        submittedAt: t.submittedAt.toISOString(),
        reviewedAt: t.reviewedAt ? t.reviewedAt.toISOString() : null,
        reviewerComment: t.reviewerComment,
        supervisor: t.supervisor,
      }
    }
  }

  const pendingFeedbackCount = project
    ? await db.feedback.count({
        where: { studentId, status: "PENDING" },
      })
    : 0

  const unreadNotifications = await db.notification.count({
    where: { userId: studentId, isRead: false },
  })

  // Recent activities: student's notifications (last 6)
  const recentActivities = await db.notification.findMany({
    where: { userId: studentId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      createdAt: true,
      isRead: true,
      link: true,
    },
  })

  // Milestone status breakdown for chart
  let milestoneBreakdown: { status: string; count: number; color: string }[] = []
  let documentTypeDistribution: { type: string; count: number }[] = []
  let totalMilestones = 0
  let completedMilestones = 0

  if (project) {
    const ms = project.milestones
    totalMilestones = ms.length
    completedMilestones = ms.filter((m) => m.status === "COMPLETED").length
    const counts: Record<string, number> = {}
    ms.forEach((m) => {
      counts[m.status] = (counts[m.status] ?? 0) + 1
    })
    const colorMap: Record<string, string> = {
      COMPLETED: "#10b981",
      IN_PROGRESS: "#f59e0b",
      NOT_STARTED: "#94a3b8",
      OVERDUE: "#f43f5e",
    }
    milestoneBreakdown = (
      ["COMPLETED", "IN_PROGRESS", "NOT_STARTED", "OVERDUE"] as const
    ).map((s) => ({
      status: s,
      count: counts[s] ?? 0,
      color: colorMap[s],
    }))

    // Document type distribution
    const docCounts: Record<string, number> = {}
    project.documents.forEach((d) => {
      docCounts[d.documentType] = (docCounts[d.documentType] ?? 0) + 1
    })
    documentTypeDistribution = Object.entries(docCounts).map(([type, count]) => ({
      type,
      count,
    }))
  }

  return NextResponse.json({
    success: true,
    data: {
      project,
      latestTopic,
      pendingFeedbackCount,
      unreadNotifications,
      hasProject: !!project,
      milestoneBreakdown,
      documentTypeDistribution,
      totalMilestones,
      completedMilestones,
      recentActivities,
    },
  })
}
