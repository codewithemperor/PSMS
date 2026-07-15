import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/health — lightweight liveness + readiness probe
// Public (no auth). Checks DB connectivity by counting users.
export async function GET() {
  const started = Date.now()
  try {
    const userCount = await db.user.count()
    return NextResponse.json({
      status: "ok",
      service: "psms",
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - started,
      db: { connected: true, userCount },
      version: "0.4.0",
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "psms",
        timestamp: new Date().toISOString(),
        db: {
          connected: false,
          error: err instanceof Error ? err.message : "Unknown DB error",
        },
      },
      { status: 503 },
    )
  }
}
