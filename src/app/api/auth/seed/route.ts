import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * POST /api/auth/seed
 * Idempotent: only runs when the User table is empty.
 * Mirrors the standalone prisma/seed.ts script for environments where the
 * CLI seed wasn't run. Returns existing counts if data is already present.
 */
export async function POST() {
  const existing = await db.user.count()
  if (existing > 0) {
    const stats = {
      users: existing,
      students: await db.user.count({ where: { role: "STUDENT" } }),
      supervisors: await db.user.count({ where: { role: "SUPERVISOR" } }),
      projects: await db.project.count(),
      topics: await db.topic.count(),
      milestones: await db.milestone.count(),
      documents: await db.document.count(),
    }
    return NextResponse.json({
      success: true,
      message: "Database already seeded",
      stats,
    })
  }

  return NextResponse.json({
    success: false,
    error:
      "Database is empty. Run `bun run db:seed` from the project root to load demo data (the API route does not seed automatically for safety).",
  })
}
