import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/dashboard/supervisor — supervisor's personalized dashboard data.
// Returns the Phase-4 spec fields (myStudents, activeProjects, completedProjects,
// pendingReviews, documentsToReview, overdueMilestones, averageStudentProgress,
// studentsProgress[], upcomingDeadlines[], recentFeedback[]) PLUS the enriched
// chart data (projectStatusDistribution, milestoneBreakdown, studentProgress,
// recentActivities) consumed by the dashboard component.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const supervisorId = session.user.id

  // Active allocations for this supervisor — the SINGLE SOURCE OF TRUTH for
  // "who is my student right now". Every count below is filtered by this list
  // (NOT by Project.supervisorId, which can drift stale if a student was
  // reassigned via the revoke endpoint without a new allocation being created
  // in the same transaction). This guarantees the dashboard stats always
  // match the My Students page.
  const allocations = await db.allocation.findMany({
    where: { supervisorId, status: "ACTIVE" },
    select: { studentId: true },
  })
  const studentIds = allocations.map((a) => a.studentId)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Supervisor's own profile — surfaced to the dashboard so the header can
  // greet them by their full name and show department / specialization /
  // capacity (mirrors the "Supervisor Profile" card the student sees on
  // their My Project page). Without this, the dashboard only had access to
  // session.user.name via the client store and was greeting "Prof." instead
  // of "Prof. Chinedu Eze".
  const supervisorProfile = await db.user.findUnique({
    where: { id: supervisorId },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      avatar: true,
      supervisorProfile: {
        select: {
          specialization: true,
          bio: true,
          maxStudents: true,
          currentLoad: true,
        },
      },
    },
  })

  // Common filter clauses derived from active allocations.
  // - studentIdIn: matches any project whose student is currently allocated
  //   to this supervisor (one project per student, so this is exact).
  // - projectStudentIn: same, expressed as a nested project filter for the
  //   document/milestone/feedback counts.
  const studentIdIn = studentIds.length
    ? { studentId: { in: studentIds } }
    : { id: "__none__" /* impossible id → empty result */ }
  const projectStudentIn = studentIds.length
    ? { project: { studentId: { in: studentIds } } }
    : { id: "__none__" }

  const [
    totalStudents,
    totalProjects,
    activeProjects,
    completedProjects,
    pendingTopics,
    totalDocuments,
    documentsToReview,
    pendingDocuments,
    totalFeedback,
    milestonesInProgress,
    milestonesCompleted,
    milestonesOverdue,
    milestonesNotStarted,
  ] = await Promise.all([
    // totalStudents: count of users who are CURRENTLY allocated to this
    // supervisor (active allocation) AND are active students. This matches
    // the My Students page filter exactly.
    db.user.count({
      where: {
        id: { in: studentIds },
        role: "STUDENT",
        isActive: true,
      },
    }),
    // totalProjects: count of projects whose STUDENT is currently allocated
    // to this supervisor (NOT filtered by Project.supervisorId, which can be
    // stale). One project per student, so this equals the number of
    // allocated students who have a project.
    db.project.count({ where: studentIdIn }),
    db.project.count({
      where: { ...studentIdIn, status: "IN_PROGRESS" },
    }),
    db.project.count({
      where: { ...studentIdIn, status: "APPROVED" },
    }),
    // Pending topics submitted to THIS supervisor (topic.supervisorId is the
    // intended supervisor at submission time and doesn't change on reassign,
    // so this filter is correct).
    db.topic.count({ where: { supervisorId, status: "PENDING" } }),
    db.document.count({ where: projectStudentIn }),
    // documentsToReview: docs uploaded by my CURRENT students within 7 days
    db.document.count({
      where: {
        ...projectStudentIn,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    // pendingDocuments: docs with no feedback yet
    db.document.count({
      where: {
        ...projectStudentIn,
        feedback: { none: {} },
      },
    }),
    // totalFeedback: feedback this supervisor has authored (historical —
    // includes feedback on projects that have since been reassigned away).
    db.feedback.count({ where: { authorId: supervisorId } }),
    db.milestone.count({
      where: { ...projectStudentIn, status: "IN_PROGRESS" },
    }),
    db.milestone.count({
      where: { ...projectStudentIn, status: "COMPLETED" },
    }),
    db.milestone.count({
      where: {
        ...projectStudentIn,
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    }),
    db.milestone.count({
      where: { ...projectStudentIn, status: "NOT_STARTED" },
    }),
  ])

  // Projects with student info + milestones (for charts + studentsProgress).
  // Filtered by active-allocation studentIds (NOT by Project.supervisorId)
  // so a stale supervisorId on a reassigned student's project doesn't
  // surface it on the old supervisor's dashboard.
  const projects = await db.project.findMany({
    where: studentIdIn,
    select: {
      id: true,
      title: true,
      progress: true,
      status: true,
      updatedAt: true,
      student: { select: { id: true, name: true, matricNo: true } },
      milestones: {
        select: {
          id: true,
          name: true,
          status: true,
          order: true,
          dueDate: true,
          weight: true,
        },
        orderBy: { order: "asc" },
      },
      documents: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      feedback: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      topics: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { progress: "desc" },
  })

  // studentsProgress per spec: studentId, studentName, studentMatricNo,
  // projectId, projectTitle, progress, status, lastActivity
  const studentsProgress = projects.map((p) => {
    const lastDoc = p.documents[0]?.createdAt
    const lastFb = p.feedback[0]?.createdAt
    const lastTopic = p.topics[0]?.createdAt
    const lastActivity = [p.updatedAt, lastDoc, lastFb, lastTopic]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
    return {
      studentId: p.student.id,
      studentName: p.student.name,
      studentMatricNo: p.student.matricNo ?? "",
      projectId: p.id,
      projectTitle: p.title,
      progress: p.progress,
      status: p.status,
      lastActivity: lastActivity ?? p.updatedAt,
    }
  })

  const averageStudentProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((s, p) => s + p.progress, 0) / projects.length,
        )
      : 0

  // upcomingDeadlines: milestones NOT COMPLETED, ordered by dueDate ASC, take 5.
  // Filtered by active-allocation studentIds for consistency with the rest
  // of the dashboard.
  const upcomingMilestones = await db.milestone.findMany({
    where: {
      ...projectStudentIn,
      status: { not: "COMPLETED" },
      dueDate: { not: null },
    },
    select: {
      id: true,
      name: true,
      dueDate: true,
      status: true,
      project: {
        select: { student: { select: { name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  })
  const now = new Date()
  const upcomingDeadlines = upcomingMilestones.map((m) => {
    const due = new Date(m.dueDate!)
    const daysUntil = Math.round(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )
    return {
      id: m.id,
      milestoneName: m.name,
      studentName: m.project.student.name,
      dueDate: m.dueDate,
      daysUntil,
      isOverdue: daysUntil < 0,
    }
  })

  // recentFeedback: last 5 feedback authored by this supervisor
  const recentFeedback = await db.feedback.findMany({
    where: { authorId: supervisorId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      content: true,
      createdAt: true,
      student: { select: { name: true } },
      document: { select: { title: true } },
    },
  })

  // Project status distribution for donut chart (filtered by active
  // allocations so the chart matches the stat cards).
  const statusGroups = await db.project.groupBy({
    by: ["status"],
    _count: { status: true },
    where: studentIdIn,
  })
  const projectStatusDistribution = (
    [
      "NOT_STARTED",
      "IN_PROGRESS",
      "SUBMITTED",
      "APPROVED",
      "REJECTED",
    ] as const
  ).map((status) => ({
    status,
    count: statusGroups.find((g) => g.status === status)?._count.status ?? 0,
  }))

  // Milestone breakdown for bar chart
  const milestoneBreakdown = [
    { status: "COMPLETED", count: milestonesCompleted, color: "#10b981" },
    { status: "IN_PROGRESS", count: milestonesInProgress, color: "#f59e0b" },
    { status: "NOT_STARTED", count: milestonesNotStarted, color: "#94a3b8" },
    { status: "OVERDUE", count: milestonesOverdue, color: "#f43f5e" },
  ]

  // Per-student progress for the bar chart
  const studentProgress = projects.map((p) => ({
    name: p.student.name.split(" ").slice(-1)[0],
    fullName: p.student.name,
    progress: p.progress,
    title: p.title,
  }))

  // Recent activities: notifications for the supervisor (last 8)
  const recentNotifications = await db.notification.findMany({
    where: { userId: supervisorId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      createdAt: true,
      isRead: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      // Supervisor's own profile — used by the dashboard header to greet the
      // supervisor by their full name and show department / specialization /
      // capacity card (parity with the student's "Supervisor Profile" view).
      supervisor: supervisorProfile
        ? {
            id: supervisorProfile.id,
            name: supervisorProfile.name,
            email: supervisorProfile.email,
            department: supervisorProfile.department,
            avatar: supervisorProfile.avatar,
            specialization:
              supervisorProfile.supervisorProfile?.specialization ?? null,
            bio: supervisorProfile.supervisorProfile?.bio ?? null,
            maxStudents: supervisorProfile.supervisorProfile?.maxStudents ?? 0,
            currentLoad:
              supervisorProfile.supervisorProfile?.currentLoad ?? 0,
          }
        : null,
      // Phase-4 spec fields
      myStudents: totalStudents,
      activeProjects,
      completedProjects,
      pendingReviews: pendingTopics,
      documentsToReview,
      overdueMilestones: milestonesOverdue,
      averageStudentProgress,
      studentsProgress,
      upcomingDeadlines,
      recentFeedback,
      // Enriched fields for the chart-driven dashboard
      totalStudents,
      totalProjects,
      pendingTopics,
      totalDocuments,
      pendingDocuments,
      totalFeedback,
      milestonesInProgress,
      milestonesCompleted,
      milestonesOverdue,
      milestonesNotStarted,
      projects,
      projectStatusDistribution,
      milestoneBreakdown,
      studentProgress,
      recentActivities: recentNotifications,
    },
  })
}
