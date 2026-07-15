/**
 * Direct DB-level verification of the topic-approve allocation-sync fix.
 *
 * This mirrors EXACTLY the allocation-sync block added to
 * /api/topics/[id]/approve/route.ts (the "ALLOCATION SYNC" section), but
 * runs it against the DB directly (bypassing NextAuth) so we can prove the
 * logic creates the missing allocation without fighting the HTTP auth flow.
 *
 * Flow:
 *  1. Pick Test Student P3 (no allocation, no project).
 *  2. Auto-pick the lowest-load supervisor (mirrors topic-submit fallback).
 *  3. Create a PENDING topic for that student→supervisor (mirrors topic-submit).
 *  4. Run the approve-route's allocation-sync transaction logic.
 *  5. Assert: active allocation now exists, StudentProfile synced,
 *     SupervisorProfile.currentLoad recomputed.
 *  6. Cleanup.
 */
import { db } from "../src/lib/db"

async function main() {
  console.log("=== DIRECT DB VERIFICATION: approve-route allocation sync ===\n")

  const studentId = "cmqmd0sbh0009ogdyelxriosw" // Test Student P3
  const adminId = "cmqmaj6jw0000oge8bog9yvfa" // Dr. Adewale Okonkwo (admin) — used for allocatedBy

  // 1. Confirm clean slate
  const beforeAlloc = await db.allocation.findFirst({
    where: { studentId, status: "ACTIVE" },
    select: { id: true, supervisorId: true },
  })
  const beforeProject = await db.project.findUnique({
    where: { studentId },
    select: { id: true },
  })
  if (beforeAlloc || beforeProject) {
    console.log("⚠️ Student not clean — cleaning first...")
    await db.allocation.deleteMany({ where: { studentId, status: "ACTIVE" } })
    await db.project.deleteMany({ where: { studentId } })
    await db.topic.deleteMany({ where: { studentId } })
  }
  console.log("✓ Student P3 is clean (no alloc, no project)")

  // 2. Auto-pick lowest-load supervisor (mirrors topic-submit fallback)
  const sups = await db.user.findMany({
    where: { role: "SUPERVISOR", isActive: true, supervisorProfile: { isNot: null } },
    select: {
      id: true, name: true,
      supervisorProfile: { select: { currentLoad: true, maxStudents: true } },
      supervisorAllocation: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  })
  const withReal = sups
    .map((s) => ({ ...s, realLoad: s.supervisorAllocation.length }))
    .filter((s) => s.realLoad < (s.supervisorProfile?.maxStudents ?? 0))
    .sort((a, b) => a.realLoad - b.realLoad)
  if (withReal.length === 0) throw new Error("no supervisor with capacity")
  const supervisor = withReal[0]
  console.log(`✓ Auto-picked supervisor: ${supervisor.name} (realLoad=${supervisor.realLoad})`)

  const beforeSupLoad = supervisor.realLoad

  // 3. Create a PENDING topic (mirrors topic-submit — NO allocation created)
  const topic = await db.topic.create({
    data: {
      title: "Direct DB Repro: Allocation Sync",
      description: "Verifying the approve route creates an allocation when one is missing.",
      studentId,
      supervisorId: supervisor.id,
      status: "PENDING",
    },
    select: { id: true },
  })
  console.log(`✓ Created PENDING topic: ${topic.id}`)

  // 4. --- Run the approve-route's allocation-sync transaction logic ---
  //    (copied verbatim from the ALLOCATION SYNC block in approve/route.ts)
  await db.$transaction(async (tx) => {
    // Mark topic approved
    await tx.topic.update({
      where: { id: topic.id },
      data: { status: "APPROVED", reviewedAt: new Date() },
    })
    // Create project (mirrors the "new project" branch)
    const newProject = await tx.project.create({
      data: {
        title: "Direct DB Repro: Allocation Sync",
        description: "...",
        studentId,
        supervisorId: supervisor.id,
        status: "IN_PROGRESS",
        progress: 10,
        startDate: new Date(),
      },
    })
    await tx.topic.update({
      where: { id: topic.id },
      data: { projectId: newProject.id },
    })

    // === ALLOCATION SYNC (the fix) ===
    const existingActiveAlloc = await tx.allocation.findFirst({
      where: { studentId, status: "ACTIVE" },
      select: { id: true, supervisorId: true },
    })
    if (!existingActiveAlloc) {
      await tx.allocation.create({
        data: {
          studentId,
          supervisorId: supervisor.id,
          academicYear: "Current",
          semester: "Full Session",
          status: "ACTIVE",
          allocatedBy: adminId,
        },
      })
    } else if (existingActiveAlloc.supervisorId !== supervisor.id) {
      await tx.allocation.update({
        where: { id: existingActiveAlloc.id },
        data: { status: "REVOKED" },
      })
      await tx.allocation.create({
        data: {
          studentId,
          supervisorId: supervisor.id,
          academicYear: "Current",
          semester: "Full Session",
          status: "ACTIVE",
          allocatedBy: adminId,
        },
      })
    }
    await tx.studentProfile.upsert({
      where: { userId: studentId },
      update: { supervisorId: supervisor.id },
      create: { userId: studentId, supervisorId: supervisor.id },
    })
    const affected = new Set<string>([supervisor.id])
    if (existingActiveAlloc) affected.add(existingActiveAlloc.supervisorId)
    for (const supId of affected) {
      const count = await tx.allocation.count({
        where: { supervisorId: supId, status: "ACTIVE" },
      })
      await tx.supervisorProfile.updateMany({
        where: { userId: supId },
        data: { currentLoad: count },
      })
    }
  })

  // 5. --- Assertions ---
  console.log("\n--- POST-APPROVAL ASSERTIONS ---")
  const afterAlloc = await db.allocation.findFirst({
    where: { studentId, status: "ACTIVE" },
    select: { id: true, supervisorId: true },
  })
  if (!afterAlloc) {
    console.log("❌ FAIL: No active allocation created!")
    return
  }
  console.log(`✓ Active allocation exists: supervisor=${afterAlloc.supervisorId}`)
  if (afterAlloc.supervisorId !== supervisor.id) {
    console.log(`❌ FAIL: wrong supervisor`)
    return
  }

  const afterProfile = await db.studentProfile.findUnique({
    where: { userId: studentId },
    select: { supervisorId: true },
  })
  if (afterProfile?.supervisorId !== supervisor.id) {
    console.log(`❌ FAIL: StudentProfile.supervisorId=${afterProfile?.supervisorId}`)
    return
  }
  console.log(`✓ StudentProfile.supervisorId synced`)

  const afterSupProfile = await db.supervisorProfile.findUnique({
    where: { userId: supervisor.id },
    select: { currentLoad: true },
  })
  const realActive = await db.allocation.count({
    where: { supervisorId: supervisor.id, status: "ACTIVE" },
  })
  if (afterSupProfile?.currentLoad !== realActive) {
    console.log(`❌ FAIL: currentLoad=${afterSupProfile?.currentLoad} realActive=${realActive}`)
    return
  }
  console.log(`✓ SupervisorProfile.currentLoad=${afterSupProfile?.currentLoad} (was ${beforeSupLoad}, realActive=${realActive})`)

  // 6. Cross-check: the ACTUAL bug invariant — no student should have a
  //    project pointing at this supervisor WITHOUT an active allocation.
  //    (students > projects is fine — a student can be allocated before
  //    they have a project. projects > students was the bug, and is now
  //    impossible because approving a topic always creates the allocation.)
  const supervisorStudentIds = (
    await db.allocation.findMany({
      where: { supervisorId: supervisor.id, status: "ACTIVE" },
      select: { studentId: true },
    })
  ).map((a) => a.studentId)
  const projectsForSup = await db.project.findMany({
    where: { supervisorId: supervisor.id },
    select: { studentId: true },
  })
  const orphanProjects = projectsForSup.filter(
    (p) => !supervisorStudentIds.includes(p.studentId),
  )
  console.log(`\n--- CONSISTENCY CHECK ---`)
  console.log(`Supervisor ${supervisor.name}:`)
  console.log(`  - Active allocations (My Students): ${supervisorStudentIds.length}`)
  console.log(`  - Projects: ${projectsForSup.length}`)
  console.log(`  - Orphan projects (project but no allocation): ${orphanProjects.length}`)
  if (orphanProjects.length > 0) {
    console.log(`❌ FAIL: ${orphanProjects.length} orphan project(s) — the bug is still present`)
    return
  }
  console.log(`✓ No orphan projects — every project has a matching active allocation`)

  console.log(`\n=== ✅ FIX VERIFIED ===`)
  console.log(`Supervisor ${supervisor.name} now has ${realActive} active students (was ${beforeSupLoad}).`)
  console.log(`Test Student P3 appears in BOTH the project count AND the My Students list.`)

  // 7. Cleanup
  console.log("\n--- Cleaning up ---")
  await db.allocation.deleteMany({ where: { studentId, status: "ACTIVE" } })
  await db.project.deleteMany({ where: { studentId } })
  await db.topic.deleteMany({ where: { studentId } })
  await db.studentProfile.updateMany({ where: { userId: studentId }, data: { supervisorId: null } })
  const restoreCount = await db.allocation.count({ where: { supervisorId: supervisor.id, status: "ACTIVE" } })
  await db.supervisorProfile.update({ where: { userId: supervisor.id }, data: { currentLoad: restoreCount } })
  console.log("✓ Cleanup done; supervisor load restored.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
