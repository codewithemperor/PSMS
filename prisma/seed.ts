/**
 * PSMS — Standalone seed script (Phase 1)
 *
 * Run with:  bun run db:seed
 *
 * Idempotent: only runs when the User table is empty.
 *
 * Creates:
 *   - 8 users  (1 admin, 2 supervisors, 5 students) — all password: password123
 *   - Student/Supervisor profiles for every user
 *   - Allocations  (students 1-3 → supervisor 1, students 4-5 → supervisor 2)
 *   - Topics       (students 1-3 APPROVED, student 4 PENDING, student 5 REVISION_REQUIRED)
 *   - Projects     (students 1-3, IN_PROGRESS, progress 45/25/70)
 *   - 5 milestones per project
 *   - Sample documents (student 1: 2 proposals; student 3: 1 lit-review)
 *   - Sample feedback on student 1's docs (1 PENDING, 1 ADDRESSED)
 *   - 3 sample notifications for student 1
 *   - Supervisor currentLoad updated to match allocations
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

const ACADEMIC_YEAR = "2024/2025"
const SEMESTER = "First Semester"

async function main() {
  const existing = await db.user.count()
  if (existing > 0) {
    console.log(`\n⚠  Database already has ${existing} users. Skipping seed.\n`)
    return
  }

  console.log("\n🌱 Seeding PSMS database...")
  const passwordHash = await bcrypt.hash("password123", 10)

  // -----------------------------------------------------------------------
  // 1. Users + profiles
  // -----------------------------------------------------------------------
  const admin = await db.user.create({
    data: {
      email: "admin@psms.edu",
      password: passwordHash,
      name: "Dr. Adewale Okonkwo",
      role: "ADMIN",
      staffId: "ADM001",
      department: "Computer Science",
      phone: "+234 800 000 0001",
    },
  })

  const supervisor1 = await db.user.create({
    data: {
      email: "supervisor1@psms.edu",
      password: passwordHash,
      name: "Prof. Chinedu Eze",
      role: "SUPERVISOR",
      staffId: "SUP001",
      department: "Computer Science",
      phone: "+234 800 000 0002",
      supervisorProfile: {
        create: {
          specialization: "Software Engineering",
          maxStudents: 5,
          currentLoad: 0,
          bio: "Professor of Software Engineering with 15 years of research experience.",
        },
      },
    },
  })

  const supervisor2 = await db.user.create({
    data: {
      email: "supervisor2@psms.edu",
      password: passwordHash,
      name: "Dr. Amina Bello",
      role: "SUPERVISOR",
      staffId: "SUP002",
      department: "Computer Science",
      phone: "+234 800 000 0003",
      supervisorProfile: {
        create: {
          specialization: "Data Science & AI",
          maxStudents: 5,
          currentLoad: 0,
          bio: "Data Science and AI researcher focused on machine learning applications.",
        },
      },
    },
  })

  const studentsRaw = [
    { email: "student1@psms.edu", name: "James Okafor", matricNo: "CS/2021/001", supervisor: supervisor1 },
    { email: "student2@psms.edu", name: "Fatima Ibrahim", matricNo: "CS/2021/002", supervisor: supervisor1 },
    { email: "student3@psms.edu", name: "Emeka Nwankwo", matricNo: "CS/2021/003", supervisor: supervisor1 },
    { email: "student4@psms.edu", name: "Aisha Mohammed", matricNo: "CS/2021/004", supervisor: supervisor2 },
    { email: "student5@psms.edu", name: "Chidi Anyanwu", matricNo: "CS/2021/005", supervisor: supervisor2 },
  ]

  const students = [] as { id: string; email: string; name: string; matricNo: string; supervisorId: string }[]
  for (const s of studentsRaw) {
    const u = await db.user.create({
      data: {
        email: s.email,
        password: passwordHash,
        name: s.name,
        role: "STUDENT",
        matricNo: s.matricNo,
        department: "Computer Science",
        phone: "+234 800 000 0011",
        studentProfile: {
          create: {
            level: "400",
            programme: "B.Sc. Computer Science",
            supervisorId: s.supervisor.id,
            enrollmentYear: 2021,
          },
        },
      },
    })
    students.push({ id: u.id, email: u.email, name: u.name, matricNo: s.matricNo, supervisorId: s.supervisor.id })
  }

  // -----------------------------------------------------------------------
  // 2. Allocations
  // -----------------------------------------------------------------------
  const allocationsData = [
    { student: students[0], supervisor: supervisor1 },
    { student: students[1], supervisor: supervisor1 },
    { student: students[2], supervisor: supervisor1 },
    { student: students[3], supervisor: supervisor2 },
    { student: students[4], supervisor: supervisor2 },
  ]
  for (const a of allocationsData) {
    await db.allocation.create({
      data: {
        studentId: a.student.id,
        supervisorId: a.supervisor.id,
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
        status: "ACTIVE",
        allocatedBy: admin.id,
      },
    })
  }

  // -----------------------------------------------------------------------
  // 3. Topics
  // -----------------------------------------------------------------------
  const topicTitles = [
    "A Web-Based Project Supervision Management System",
    "Machine Learning Approach to Student Performance Prediction",
    "Secure E-Voting System Using Blockchain Technology",
    "IoT-Based Smart Agriculture Monitoring System",
    "Automated Library Management Using Natural Language Processing",
  ]

  const topics = [] as { id: string; studentIdx: number }[]
  const topicStatuses = ["APPROVED", "APPROVED", "APPROVED", "PENDING", "REVISION_REQUIRED"] as const
  for (let i = 0; i < students.length; i++) {
    const t = await db.topic.create({
      data: {
        title: topicTitles[i],
        description:
          "This project investigates and develops a computer-based solution addressing the stated problem domain, including system design, implementation, and evaluation.",
        studentId: students[i].id,
        supervisorId: students[i].supervisorId,
        status: topicStatuses[i],
        reviewedAt: topicStatuses[i] !== "PENDING" ? new Date() : null,
        reviewerComment:
          topicStatuses[i] === "APPROVED"
            ? "Well-focused topic. Approved."
            : topicStatuses[i] === "REVISION_REQUIRED"
            ? "Please narrow the scope to a specific case study."
            : null,
      },
    })
    topics.push({ id: t.id, studentIdx: i })
  }

  // -----------------------------------------------------------------------
  // 4. Projects (students 1-3)
  // -----------------------------------------------------------------------
  const projectProgress = [45, 25, 70]
  const projects = [] as { id: string; studentIdx: number }[]
  for (let i = 0; i < 3; i++) {
    const p = await db.project.create({
      data: {
        title: topicTitles[i],
        description:
          "Project workspace tracking deliverables, milestones, documents, and supervisor feedback for the approved topic.",
        studentId: students[i].id,
        supervisorId: students[i].supervisorId,
        status: "IN_PROGRESS",
        startDate: new Date("2024-09-01"),
        expectedEndDate: new Date("2025-06-30"),
        progress: projectProgress[i],
      },
    })
    // link the approved topic to this project
    await db.topic.update({ where: { id: topics[i].id }, data: { projectId: p.id } })
    projects.push({ id: p.id, studentIdx: i })
  }

  // -----------------------------------------------------------------------
  // 5. Milestones (5 per project) — statuses vary per project
  // -----------------------------------------------------------------------
  // [proposal, litReview, dataCollection] statuses vary; topicApproval=COMPLETED; finalReport=NOT_STARTED
  const milestoneVariants = [
    { proposal: "COMPLETED", litReview: "IN_PROGRESS", dataCollection: "NOT_STARTED" },
    { proposal: "IN_PROGRESS", litReview: "NOT_STARTED", dataCollection: "NOT_STARTED" },
    { proposal: "COMPLETED", litReview: "COMPLETED", dataCollection: "IN_PROGRESS" },
  ] as const

  for (const proj of projects) {
    const v = milestoneVariants[proj.studentIdx]
    const baseDate = new Date("2024-09-15")
    const milestones = [
      { name: "Topic Approval", status: "COMPLETED", weight: 10, order: 1, due: addDays(baseDate, 14), completed: addDays(baseDate, 10) },
      { name: "Proposal Submission", status: v.proposal, weight: 15, order: 2, due: addDays(baseDate, 45), completed: v.proposal === "COMPLETED" ? addDays(baseDate, 40) : null },
      { name: "Literature Review", status: v.litReview, weight: 20, order: 3, due: addDays(baseDate, 90), completed: v.litReview === "COMPLETED" ? addDays(baseDate, 85) : null },
      { name: "Data Collection & Analysis", status: v.dataCollection, weight: 25, order: 4, due: addDays(baseDate, 150), completed: v.dataCollection === "COMPLETED" ? addDays(baseDate, 145) : null },
      { name: "Final Report & Submission", status: "NOT_STARTED", weight: 30, order: 5, due: addDays(baseDate, 210), completed: null },
    ] as const

    for (const m of milestones) {
      await db.milestone.create({
        data: {
          name: m.name,
          description: `Deliverable: ${m.name}.`,
          projectId: proj.id,
          dueDate: m.due,
          completedDate: m.completed,
          status: m.status,
          order: m.order,
          weight: m.weight,
        },
      })
    }
  }

  // -----------------------------------------------------------------------
  // 6. Documents — student 1 (2 proposals, v1 & v2), student 3 (1 lit review)
  // -----------------------------------------------------------------------
  const project1 = projects[0]
  const project3 = projects[2]

  const doc1v1 = await db.document.create({
    data: {
      title: "Project Proposal — Draft 1",
      description: "Initial proposal draft submitted for review.",
      fileName: "proposal-v1.pdf",
      fileSize: 248320,
      fileType: "application/pdf",
      filePath: "/uploads/proposal-v1.pdf",
      version: 1,
      documentType: "PROPOSAL",
      projectId: project1.id,
      uploadedById: students[0].id,
      isFinal: false,
    },
  })
  const doc1v2 = await db.document.create({
    data: {
      title: "Project Proposal — Draft 2",
      description: "Revised proposal addressing supervisor feedback.",
      fileName: "proposal-v2.pdf",
      fileSize: 262144,
      fileType: "application/pdf",
      filePath: "/uploads/proposal-v2.pdf",
      version: 2,
      documentType: "PROPOSAL",
      projectId: project1.id,
      uploadedById: students[0].id,
      isFinal: false,
    },
  })
  await db.document.create({
    data: {
      title: "Literature Review",
      description: "Comprehensive review of related work.",
      fileName: "literature-review.pdf",
      fileSize: 512000,
      fileType: "application/pdf",
      filePath: "/uploads/literature-review.pdf",
      version: 1,
      documentType: "LITERATURE_REVIEW",
      projectId: project3.id,
      uploadedById: students[2].id,
      isFinal: false,
    },
  })

  // -----------------------------------------------------------------------
  // 7. Feedback on student 1's documents (1 PENDING, 1 ADDRESSED)
  // -----------------------------------------------------------------------
  await db.feedback.create({
    data: {
      content:
        "Good start. Please strengthen the problem statement and add more recent references (2022+) in the related work section.",
      documentId: doc1v1.id,
      projectId: project1.id,
      authorId: supervisor1.id,
      studentId: students[0].id,
      status: "ADDRESSED",
    },
  })
  await db.feedback.create({
    data: {
      content:
        "Draft 2 is much improved. Before finalising, clarify the methodology timeline and include a Gantt chart in the appendix.",
      documentId: doc1v2.id,
      projectId: project1.id,
      authorId: supervisor1.id,
      studentId: students[0].id,
      status: "PENDING",
    },
  })

  // -----------------------------------------------------------------------
  // 8. Notifications for student 1
  // -----------------------------------------------------------------------
  await db.notification.create({
    data: {
      title: "Topic Approved",
      message: "Your project topic has been approved by your supervisor.",
      type: "TOPIC_APPROVED",
      userId: students[0].id,
      link: "/student/topic",
      isRead: false,
    },
  })
  await db.notification.create({
    data: {
      title: "New Feedback",
      message: "Prof. Chinedu Eze left feedback on your proposal draft.",
      type: "FEEDBACK_GIVEN",
      userId: students[0].id,
      link: "/student/feedback",
      isRead: false,
    },
  })
  await db.notification.create({
    data: {
      title: "Milestone Due Soon",
      message: "Literature Review milestone is due in 7 days.",
      type: "MILESTONE_DUE",
      userId: students[0].id,
      link: "/student/progress",
      isRead: true,
      readAt: new Date(),
    },
  })

  // -----------------------------------------------------------------------
  // 9. Update supervisor currentLoad
  // -----------------------------------------------------------------------
  await db.supervisorProfile.update({ where: { userId: supervisor1.id }, data: { currentLoad: 3 } })
  await db.supervisorProfile.update({ where: { userId: supervisor2.id }, data: { currentLoad: 2 } })

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  const stats = {
    users: await db.user.count(),
    students: await db.user.count({ where: { role: "STUDENT" } }),
    supervisors: await db.user.count({ where: { role: "SUPERVISOR" } }),
    admins: await db.user.count({ where: { role: "ADMIN" } }),
    allocations: await db.allocation.count(),
    topics: await db.topic.count(),
    projects: await db.project.count(),
    milestones: await db.milestone.count(),
    documents: await db.document.count(),
    feedback: await db.feedback.count(),
    notifications: await db.notification.count(),
  }

  console.log("\n✅  Seed complete!\n")
  console.table(stats)
  console.log("\nDemo logins (password: password123):")
  console.log("  Admin       → admin@psms.edu")
  console.log("  Supervisor  → supervisor1@psms.edu / supervisor2@psms.edu")
  console.log("  Student     → student1..5@psms.edu\n")
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
