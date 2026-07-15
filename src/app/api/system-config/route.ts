import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") return null
  return session
}

/**
 * Returns the singleton SystemConfig row, creating it with schema defaults
 * if it doesn't exist yet (first run).
 */
async function getConfig() {
  let config = await db.systemConfig.findFirst()
  if (!config) {
    config = await db.systemConfig.create({ data: {} })
  }
  return config
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getConfig()
  return NextResponse.json({
    success: true,
    data: {
      id: config.id,
      appName: config.appName,
      appShortName: config.appShortName,
      logoUrl: config.logoUrl,
      maxStudentsPerSupervisor: config.maxStudentsPerSupervisor,
      updatedAt: config.updatedAt,
    },
  })
}

const patchSchema = z.object({
  appName: z.string().min(2).max(120).optional(),
  appShortName: z.string().min(1).max(20).optional(),
  logoUrl: z.string().url().nullable().or(z.literal("")).optional(),
  maxStudentsPerSupervisor: z.number().int().min(1).max(100).optional(),
})

export async function PATCH(req: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const existing = await getConfig()
  const data: Record<string, unknown> = {}
  if (parsed.data.appName !== undefined) data.appName = parsed.data.appName
  if (parsed.data.appShortName !== undefined)
    data.appShortName = parsed.data.appShortName
  if (parsed.data.logoUrl !== undefined) {
    data.logoUrl = parsed.data.logoUrl === "" ? null : parsed.data.logoUrl
  }
  if (parsed.data.maxStudentsPerSupervisor !== undefined) {
    data.maxStudentsPerSupervisor = parsed.data.maxStudentsPerSupervisor
  }

  const updated = await db.systemConfig.update({
    where: { id: existing.id },
    data,
  })

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      appName: updated.appName,
      appShortName: updated.appShortName,
      logoUrl: updated.logoUrl,
      maxStudentsPerSupervisor: updated.maxStudentsPerSupervisor,
      updatedAt: updated.updatedAt,
    },
  })
}
