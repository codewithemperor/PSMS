import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const batchSchema = z.object({
  allocations: z
    .array(
      z.object({
        studentId: z.string().min(1),
        supervisorId: z.string().min(1),
      }),
    )
    .min(1, "At least one allocation is required"),
  academicYear: z.string().min(1).default("Current"),
  semester: z.string().optional().default("Full Session"),
})

// POST /api/allocations/batch — allocate OR reassign students to supervisors.
//
// Reassignment semantics (the key fix):
//   - If a student already has an ACTIVE allocation to the SAME supervisor,
//     the request is a no-op for that student (idempotent).
//   - If a student already has an ACTIVE allocation to a DIFFERENT
//     supervisor, this is a REASSIGNMENT:
//       * the old allocation is revoked (status = REVOKED),
//       * the old supervisor's currentLoad is decremented,
//       * the student's Project.supervisorId is updated to the new
//         supervisor (this is the bug that was missing — previously the
//         Project still pointed at the old supervisor, so the student
//         portal showed the old supervisor AND the new supervisor got 403
//         when trying to submit feedback),
//       * a new allocation is created for the new supervisor,
//       * the new supervisor's currentLoad is incremented,
//       * StudentProfile.supervisorId is updated.
//   - If the student has no prior allocation, a fresh allocation is created
//     and (if the student has a project) Project.supervisorId is set.
//
// Capacity is enforced against the global SystemConfig.maxStudentsPerSupervisor
// value (configurable on the admin Settings page). Lowering the cap does NOT
// revoke existing allocations — it only blocks NEW assignments that would
// push a supervisor above the limit. A supervisor who is already over the
// (newly lowered) cap keeps their existing students but can't take more.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  const { allocations, academicYear, semester } = parsed.data

  // --- Global capacity from SystemConfig (singleton, auto-create) ---
  let config = await db.systemConfig.findFirst()
  if (!config) {
    config = await db.systemConfig.create({ data: {} })
  }
  const globalCap = config.maxStudentsPerSupervisor

  // --- Gather students, supervisors, existing allocations, projects ---
  const studentIds = [...new Set(allocations.map((a) => a.studentId))]
  const supervisorIds = [...new Set(allocations.map((a) => a.supervisorId))]

  const [students, supervisors, existingAllocs, projects, supervisorLoads] =
    await Promise.all([
      db.user.findMany({
        where: { id: { in: studentIds }, role: "STUDENT" },
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: {
            select: { supervisorId: true, level: true, programme: true },
          },
        },
      }),
      db.user.findMany({
        where: {
          id: { in: supervisorIds },
          role: "SUPERVISOR",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          supervisorProfile: { select: { currentLoad: true, maxStudents: true } },
        },
      }),
      db.allocation.findMany({
        where: {
          studentId: { in: studentIds },
          status: "ACTIVE",
        },
        select: {
          id: true,
          studentId: true,
          supervisorId: true,
          academicYear: true,
        },
      }),
      db.project.findMany({
        where: { studentId: { in: studentIds } },
        select: { id: true, studentId: true, supervisorId: true, title: true },
      }),
      db.supervisorProfile.findMany({
        where: { userId: { in: supervisorIds } },
        select: { userId: true, currentLoad: true, maxStudents: true },
      }),
    ])

  const studentMap = new Map(students.map((s) => [s.id, s]))
  const supervisorMap = new Map(supervisors.map((s) => [s.id, s]))
  const supervisorLoadMap = new Map(
    supervisorLoads.map((s) => [s.userId, s.currentLoad]),
  )
  // studentId → active allocation (there should be at most one active per student)
  const existingByStudent = new Map(
    existingAllocs.map((a) => [a.studentId, a]),
  )
  // studentId → project
  const projectByStudent = new Map(projects.map((p) => [p.studentId, p]))

  // Current real load per supervisor = count of ACTIVE allocations.
  // (SupervisorProfile.currentLoad can drift; recompute from allocations for
  // accuracy during the capacity check.)
  const allActiveAllocs = await db.allocation.findMany({
    where: { status: "ACTIVE" },
    select: { supervisorId: true, studentId: true },
  })
  const realLoadBySupervisor = new Map<string, number>()
  for (const a of allActiveAllocs) {
    realLoadBySupervisor.set(
      a.supervisorId,
      (realLoadBySupervisor.get(a.supervisorId) ?? 0) + 1,
    )
  }

  // --- Validate one by one and collect errors ---
  const errors: string[] = []
  // Tracks the net change in load per supervisor for this batch.
  const supervisorDelta = new Map<string, number>()
  // Tracks which old allocations to revoke (studentId → oldAlloc)
  const reassignments: {
    studentId: string
    newSupervisorId: string
    oldAlloc: { id: string; supervisorId: string; academicYear: string } | null
  }[] = []

  for (const alloc of allocations) {
    const { studentId, supervisorId } = alloc

    const student = studentMap.get(studentId)
    if (!student) {
      errors.push(`Student ${studentId} does not exist or is not a student`)
      continue
    }

    const supervisor = supervisorMap.get(supervisorId)
    if (!supervisor) {
      errors.push(
        `Supervisor ${supervisorId} does not exist or is not active`,
      )
      continue
    }

    const oldAlloc = existingByStudent.get(studentId) ?? null

    // Idempotent: same supervisor → skip (no change needed)
    if (oldAlloc && oldAlloc.supervisorId === supervisorId) {
      reassignments.push({ studentId, newSupervisorId: supervisorId, oldAlloc })
      continue
    }

    // Capacity check against the GLOBAL cap.
    // projected = current real load + pending deltas in this batch − (leaving old supervisor if reassign)
    const currentLoad = realLoadBySupervisor.get(supervisorId) ?? 0
    const pendingDelta = supervisorDelta.get(supervisorId) ?? 0
    // If this student is being moved AWAY from this same new supervisor... not possible here.
    const projectedLoad = currentLoad + pendingDelta + 1
    if (projectedLoad > globalCap) {
      errors.push(
        `${supervisor.name} would exceed the capacity limit (${projectedLoad}/${globalCap}). Lower the limit on Settings or choose another supervisor.`,
      )
      continue
    }

    supervisorDelta.set(supervisorId, pendingDelta + 1)
    // If reassigning, the old supervisor's load decreases by 1
    if (oldAlloc) {
      const oldDelta = supervisorDelta.get(oldAlloc.supervisorId) ?? 0
      supervisorDelta.set(oldAlloc.supervisorId, oldDelta - 1)
    }

    reassignments.push({ studentId, newSupervisorId: supervisorId, oldAlloc })
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: errors },
      { status: 400 },
    )
  }

  // --- Transaction: apply all reassignments/allocations atomically ---
  const result = await db.$transaction(async (tx) => {
    const summary: {
      id: string
      studentName: string
      supervisorName: string
      reassigned: boolean
    }[] = []

    for (const r of reassignments) {
      const student = studentMap.get(r.studentId)!
      const newSupervisor = supervisorMap.get(r.newSupervisorId)!

      // If reassigning away from a different supervisor, revoke the old alloc
      if (r.oldAlloc && r.oldAlloc.supervisorId !== r.newSupervisorId) {
        await tx.allocation.update({
          where: { id: r.oldAlloc.id },
          data: { status: "REVOKED" },
        })

        const oldSup = await tx.user.findUnique({
          where: { id: r.oldAlloc.supervisorId },
          select: { name: true },
        })

        // Notify the old supervisor + student about the reassignment
        await tx.notification.create({
          data: {
            title: "Student Reassigned",
            message: `${student.name} has been reassigned to ${newSupervisor.name}.`,
            type: "INFO",
            userId: r.oldAlloc.supervisorId,
            link: "/supervisor/students",
          },
        })
        void oldSup
      }

      // Skip creating a duplicate allocation if it's a no-op (same supervisor)
      let allocId: string
      if (r.oldAlloc && r.oldAlloc.supervisorId === r.newSupervisorId) {
        allocId = r.oldAlloc.id
      } else {
        const a = await tx.allocation.create({
          data: {
            studentId: r.studentId,
            supervisorId: r.newSupervisorId,
            academicYear,
            semester,
            status: "ACTIVE",
            allocatedBy: session.user.id!,
          },
        })
        allocId = a.id
      }

      // Update StudentProfile.supervisorId
      if (student.studentProfile) {
        await tx.studentProfile.update({
          where: { userId: r.studentId },
          data: { supervisorId: r.newSupervisorId },
        })
      }

      // *** THE KEY FIX: update Project.supervisorId so the student portal,
      // supervisor dashboard, and feedback/review authorization all see the
      // new supervisor. ***
      const project = projectByStudent.get(r.studentId)
      if (project && project.supervisorId !== r.newSupervisorId) {
        await tx.project.update({
          where: { id: project.id },
          data: { supervisorId: r.newSupervisorId },
        })
      }

      // Notify the student
      const isReassign = !!r.oldAlloc && r.oldAlloc.supervisorId !== r.newSupervisorId
      await tx.notification.create({
        data: {
          title: isReassign ? "Supervisor Reassigned" : "Supervisor Allocated",
          message: isReassign
            ? `You have been reassigned to ${newSupervisor.name} for ${academicYear}.`
            : `You have been allocated to ${newSupervisor.name} for ${academicYear}.`,
          type: "ALLOCATION_ASSIGNED",
          userId: r.studentId,
          link: "/student/progress",
        },
      })

      // Notify the new supervisor (only if it's a fresh/reassign, not no-op)
      if (!r.oldAlloc || r.oldAlloc.supervisorId !== r.newSupervisorId) {
        await tx.notification.create({
          data: {
            title: isReassign ? "New Student Reassigned to You" : "New Student Allocated",
            message: `${student.name} has been ${isReassign ? "reassigned" : "allocated"} to you for ${academicYear}.`,
            type: "ALLOCATION_ASSIGNED",
            userId: r.newSupervisorId,
            link: "/supervisor/students",
          },
        })
      }

      summary.push({
        id: allocId,
        studentName: student.name,
        supervisorName: newSupervisor.name,
        reassigned: isReassign,
      })
    }

    // Recompute SupervisorProfile.currentLoad for every affected supervisor
    // so the displayed load matches reality.
    const affectedSupervisors = new Set<string>()
    for (const r of reassignments) {
      affectedSupervisors.add(r.newSupervisorId)
      if (r.oldAlloc) affectedSupervisors.add(r.oldAlloc.supervisorId)
    }
    for (const supId of affectedSupervisors) {
      const count = await tx.allocation.count({
        where: { supervisorId: supId, status: "ACTIVE" },
      })
      await tx.supervisorProfile.updateMany({
        where: { userId: supId },
        data: { currentLoad: count },
      })
    }

    return summary
  })

  const reassignedCount = result.filter((r) => r.reassigned).length
  const allocatedCount = result.length - reassignedCount

  return NextResponse.json({
    success: true,
    message:
      reassignedCount > 0
        ? `${allocatedCount} allocated, ${reassignedCount} reassigned successfully`
        : `${result.length} student${result.length === 1 ? "" : "s"} allocated successfully`,
    count: result.length,
    data: result,
  })
}
