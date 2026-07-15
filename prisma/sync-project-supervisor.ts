/**
 * PSMS — One-off data sync script.
 *
 * Aligns Project.supervisorId with each student's CURRENT active allocation.
 *
 * Background:
 *   When a student is reassigned via the batch allocation endpoint, the
 *   endpoint correctly updates Project.supervisorId to the new supervisor.
 *   However, projects created BEFORE that fix was deployed, OR projects
 *   whose allocation was REVOKED (not reassigned), can have a stale
 *   supervisorId pointing at a supervisor who no longer has the student.
 *   This causes:
 *     - Dashboard stat mismatch ("4 active projects but 2 students")
 *     - Auth failures on /api/document-review/[id], /api/documents/[id],
 *       /api/milestones/[id] etc. (which authorize via Project.supervisorId)
 *
 * This script:
 *   1. Loads every project.
 *   2. For each, finds the student's CURRENT active allocation.
 *   3. If the active allocation's supervisorId differs from the project's
 *      supervisorId, updates the project to point at the new supervisor.
 *   4. Prints a summary of what was changed.
 *
 * Safe to re-run — it's idempotent.
 *
 * Usage:  bun run prisma/sync-project-supervisor.ts
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("→ Loading all projects…")
  const projects = await db.project.findMany({
    select: {
      id: true,
      title: true,
      studentId: true,
      supervisorId: true,
    },
  })
  console.log(`  Found ${projects.length} project(s).`)

  const studentIds = [...new Set(projects.map((p) => p.studentId))]
  const allocations = await db.allocation.findMany({
    where: { studentId: { in: studentIds }, status: "ACTIVE" },
    select: { id: true, studentId: true, supervisorId: true },
  })
  // studentId → active allocation (there should be at most one active per student)
  const activeByStudent = new Map(allocations.map((a) => [a.studentId, a]))

  let updated = 0
  let skipped = 0
  const changes: { projectId: string; title: string; from: string; to: string; studentId: string }[] = []

  for (const p of projects) {
    const active = activeByStudent.get(p.studentId)
    if (!active) {
      // No active allocation for this student — leave the project as-is.
      // (The student has no current supervisor; the project's last
      // supervisor remains the historical owner.)
      skipped++
      continue
    }
    if (active.supervisorId === p.supervisorId) {
      // Already in sync.
      continue
    }
    changes.push({
      projectId: p.id,
      title: p.title,
      from: p.supervisorId,
      to: active.supervisorId,
      studentId: p.studentId,
    })
    await db.project.update({
      where: { id: p.id },
      data: { supervisorId: active.supervisorId },
    })
    updated++
  }

  console.log("")
  console.log("═".repeat(72))
  console.log(`  Sync complete.`)
  console.log(`  Projects scanned : ${projects.length}`)
  console.log(`  Projects updated : ${updated}`)
  console.log(`  Projects skipped : ${skipped} (no active allocation)`)
  console.log(`  Projects unchanged: ${projects.length - updated - skipped}`)
  if (changes.length > 0) {
    console.log("")
    console.log("  Changes:")
    for (const c of changes) {
      console.log(
        `    • [${c.projectId.slice(-6)}] "${c.title.slice(0, 50)}"` +
        `  supervisor ${c.from.slice(-6)} → ${c.to.slice(-6)}` +
        `  (student ${c.studentId.slice(-6)})`,
      )
    }
  }
  console.log("═".repeat(72))
}

main()
  .catch((err) => {
    console.error("✗ Sync failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
