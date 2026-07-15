/**
 * Reconciliation script — repairs allocation drift.
 *
 * Run with:  bunx tsx scripts/reconcile-allocations.ts
 *
 * The ACTIVE Allocation is the single source of truth for "who is this
 * student's supervisor right now". Two other fields can drift out of sync:
 *   - Project.supervisorId
 *   - StudentProfile.supervisorId
 * And SupervisorProfile.currentLoad can drift from the real active count.
 *
 * This script also backfills MISSING allocations for students who have an
 * approved topic + project but no active allocation (the bug that produced
 * the user's "4 active projects but 2 students" mismatch — topic approval
 * historically created a Project but no Allocation).
 *
 * Pass --dry-run to preview without writing.
 */
import { db } from "../src/lib/db"

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  console.log(
    `=== ALLOCATION RECONCILIATION ${dryRun ? "(DRY RUN)" : "(WRITE)"} ===\n`,
  )

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

  // The Allocation.allocatedBy field is required (FK → User). Use the first
  // admin ID as the reconciler of record; fall back to the supervisor if no
  // admin exists.
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  })
  const reconcilerId =
    admin?.id ?? (await db.user.findFirst({ where: { role: "SUPERVISOR" }, select: { id: true } }))?.id
  if (!reconcilerId) {
    throw new Error("No admin or supervisor user found — cannot set allocatedBy on reconciled allocations.")
  }

  const fixes: { kind: string; detail: string }[] = []

  // --- Fix 1: students with an APPROVED topic but NO active allocation →
  // create an allocation pointing at the topic's supervisor. This is the
  // root-cause backfill for the user's reported mismatch. ---
  for (const t of topicByStudent.values()) {
    if (!t.supervisorId) continue
    fixes.push({
      kind: "CREATE_ALLOCATION",
      detail: `student=${t.studentId} supervisor=${t.supervisorId} (from approved topic "${t.title}")`,
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

  // --- Fix 2: Project.supervisorId must match the active allocation's
  // supervisorId (or the approved topic's supervisorId if no allocation). ---
  for (const p of projects) {
    const alloc = allocByStudent.get(p.studentId)
    const want = alloc?.supervisorId ?? profileByStudent.get(p.studentId)?.supervisorId ?? null
    if (want && p.supervisorId !== want) {
      fixes.push({
        kind: "FIX_PROJECT_SUPERVISOR",
        detail: `project=${p.id} student=${p.studentId}: ${p.supervisorId} → ${want}`,
      })
      if (!dryRun) {
        await db.project.update({
          where: { id: p.id },
          data: { supervisorId: want },
        })
      }
    }
  }

  // --- Fix 3: StudentProfile.supervisorId must match the active allocation. ---
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

  // --- Fix 4: SupervisorProfile.currentLoad must equal the real active
  // allocation count. ---
  const realLoad = new Map<string, number>()
  for (const a of activeAllocs) {
    realLoad.set(a.supervisorId, (realLoad.get(a.supervisorId) ?? 0) + 1)
  }
  // Also count the allocations we just created (for non-dry-run).
  if (!dryRun) {
    const refreshed = await db.allocation.findMany({
      where: { status: "ACTIVE" },
      select: { supervisorId: true },
    })
    realLoad.clear()
    for (const a of refreshed) {
      realLoad.set(a.supervisorId, (realLoad.get(a.supervisorId) ?? 0) + 1)
    }
  }
  for (const sp of supProfiles) {
    const want = realLoad.get(sp.userId) ?? 0
    if (sp.currentLoad !== want) {
      fixes.push({
        kind: "FIX_SUPERVISOR_LOAD",
        detail: `supervisor=${sp.userId}: currentLoad ${sp.currentLoad} → ${want}`,
      })
      if (!dryRun) {
        await db.supervisorProfile.update({
          where: { userId: sp.userId },
          data: { currentLoad: want },
        })
      }
    }
  }

  if (fixes.length === 0) {
    console.log("✓ No drift detected — all allocations, projects, profiles, and loads are consistent.")
  } else {
    console.log(`Found ${fixes.length} fix(es):\n`)
    for (const f of fixes) {
      console.log(`  [${f.kind}] ${f.detail}`)
    }
    console.log(
      dryRun
        ? "\n(dry run — no changes written. Re-run without --dry-run to apply.)"
        : "\n✓ All fixes applied.",
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
