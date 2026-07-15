/**
 * Reconciliation runner for the UPLOADED custom.db (the user's actual buggy
 * state captured in the screenshots). This proves the reconcile script fixes
 * the exact "4 active projects but 2 students" mismatch the user reported.
 *
 * Usage: bunx tsx scripts/reconcile-uploaded-db.ts [--dry-run]
 */
import { PrismaClient } from "@prisma/client"

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  process.env.DATABASE_URL = "file:/home/z/my-project/upload/custom.db"
  const db = new PrismaClient()
  console.log(`=== RECONCILE UPLOADED custom.db ${dryRun ? "(DRY RUN)" : "(WRITE)"} ===\n`)

  try {
    const [activeAllocs, projects, profiles, supProfiles, approvedTopics] =
      await Promise.all([
        db.allocation.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, studentId: true, supervisorId: true },
        }),
        db.project.findMany({
          select: { id: true, studentId: true, supervisorId: true, title: true },
        }),
        db.studentProfile.findMany({ select: { userId: true, supervisorId: true } }),
        db.supervisorProfile.findMany({
          select: { userId: true, currentLoad: true, maxStudents: true },
        }),
        db.topic.findMany({
          where: { status: "APPROVED" },
          select: { id: true, studentId: true, supervisorId: true, title: true },
        }),
      ])

    const allocByStudent = new Map(activeAllocs.map((a) => [a.studentId, a]))
    const profileByStudent = new Map(profiles.map((p) => [p.userId, p]))
    const topicByStudent = new Map(
      approvedTopics
        .filter((t) => !allocByStudent.has(t.studentId))
        .map((t) => [t.studentId, t]),
    )

    const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
    const reconcilerId = admin?.id ?? (await db.user.findFirst({ where: { role: "SUPERVISOR" }, select: { id: true } }))?.id
    if (!reconcilerId) throw new Error("no admin/supervisor found")

    // Print pre-state for the two buggy supervisors
    console.log("--- PRE-STATE (per supervisor) ---")
    const sups = await db.user.findMany({ where: { role: "SUPERVISOR" }, select: { id: true, name: true } })
    for (const s of sups) {
      const studentCount = activeAllocs.filter((a) => a.supervisorId === s.id).length
      const projectCount = projects.filter((p) => p.supervisorId === s.id).length
      const match = studentCount === projectCount ? "✓" : "⚠️ MISMATCH"
      console.log(`  ${s.name}: students=${studentCount} projects=${projectCount} ${match}`)
    }

    const fixes: { kind: string; detail: string }[] = []

    // Fix 1: create missing allocations for approved-topic students
    for (const t of topicByStudent.values()) {
      if (!t.supervisorId) continue
      fixes.push({
        kind: "CREATE_ALLOCATION",
        detail: `student=${t.studentId} → supervisor=${t.supervisorId} (topic "${t.title}")`,
      })
      if (!dryRun) {
        await db.allocation.create({
          data: {
            studentId: t.studentId,
            supervisorId: t.supervisorId,
            academicYear: "Current",
            semester: "Full Session",
            status: "ACTIVE",
            allocatedBy: reconcilerId,
          },
        })
        allocByStudent.set(t.studentId, {
          id: "reconciled",
          studentId: t.studentId,
          supervisorId: t.supervisorId,
        })
      }
    }

    // Fix 2: project.supervisorId must match allocation
    for (const p of projects) {
      const alloc = allocByStudent.get(p.studentId)
      const want = alloc?.supervisorId ?? profileByStudent.get(p.studentId)?.supervisorId ?? null
      if (want && p.supervisorId !== want) {
        fixes.push({
          kind: "FIX_PROJECT_SUPERVISOR",
          detail: `project "${p.title}": ${p.supervisorId} → ${want}`,
        })
        if (!dryRun) {
          await db.project.update({ where: { id: p.id }, data: { supervisorId: want } })
        }
      }
    }

    // Fix 3: StudentProfile.supervisorId must match allocation
    for (const a of allocByStudent.values()) {
      const prof = profileByStudent.get(a.studentId)
      if (!prof || prof.supervisorId !== a.supervisorId) {
        fixes.push({
          kind: "FIX_STUDENT_PROFILE",
          detail: `student=${a.studentId}: ${prof?.supervisorId ?? "null"} → ${a.supervisorId}`,
        })
        if (!dryRun) {
          await db.studentProfile.upsert({
            where: { userId: a.studentId },
            update: { supervisorId: a.supervisorId },
            create: { userId: a.studentId, supervisorId: a.supervisorId },
          })
        }
      }
    }

    // Fix 4: SupervisorProfile.currentLoad = real active count
    const realLoad = new Map<string, number>()
    if (!dryRun) {
      const refreshed = await db.allocation.findMany({ where: { status: "ACTIVE" }, select: { supervisorId: true } })
      for (const a of refreshed) realLoad.set(a.supervisorId, (realLoad.get(a.supervisorId) ?? 0) + 1)
    } else {
      for (const a of activeAllocs) realLoad.set(a.supervisorId, (realLoad.get(a.supervisorId) ?? 0) + 1)
      for (const t of topicByStudent.values()) if (t.supervisorId) realLoad.set(t.supervisorId, (realLoad.get(t.supervisorId) ?? 0) + 1)
    }
    for (const sp of supProfiles) {
      const want = realLoad.get(sp.userId) ?? 0
      if (sp.currentLoad !== want) {
        fixes.push({
          kind: "FIX_SUPERVISOR_LOAD",
          detail: `supervisor=${sp.userId}: ${sp.currentLoad} → ${want}`,
        })
        if (!dryRun) {
          await db.supervisorProfile.update({ where: { userId: sp.userId }, data: { currentLoad: want } })
        }
      }
    }

    console.log(`\n--- FIXES (${fixes.length}) ---`)
    for (const f of fixes) console.log(`  [${f.kind}] ${f.detail}`)

    if (!dryRun && fixes.length > 0) {
      console.log(`\n--- POST-STATE (per supervisor) ---`)
      const postAllocs = await db.allocation.findMany({ where: { status: "ACTIVE" }, select: { supervisorId: true, studentId: true } })
      const postProjects = await db.project.findMany({ select: { supervisorId: true, studentId: true } })
      for (const s of sups) {
        const sc = postAllocs.filter((a) => a.supervisorId === s.id).length
        const pc = postProjects.filter((p) => p.supervisorId === s.id).length
        const orphans = postProjects.filter((p) => p.supervisorId === s.id && !postAllocs.some((a) => a.studentId === p.studentId && a.supervisorId === s.id)).length
        console.log(`  ${s.name}: students=${sc} projects=${pc} orphanProjects=${orphans} ${orphans === 0 ? "✓" : "⚠️"}`)
      }
    }

    console.log(dryRun ? "\n(dry run — no changes written)" : "\n✓ Reconciliation complete.")
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
