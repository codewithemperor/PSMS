import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

interface RouteContext {
  params: Promise<{ id: string }>
}

const patchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Session name is required")
      .max(50, "Session name is too long")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined, {
    message: "Provide either `name` or `isActive` to update.",
  })

// PATCH /api/sessions/[id] — toggle isActive or rename (ADMIN only).
export async function PATCH(request: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const { id } = await ctx.params

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
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

  // Confirm the session exists
  const existing = await db.academicSession.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Session not found" },
      { status: 404 },
    )
  }

  const { name, isActive } = parsed.data

  try {
    const updated = await db.academicSession.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `A session named "${name}" already exists.`,
        },
        { status: 409 },
      )
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      )
    }
    throw err
  }
}

// DELETE /api/sessions/[id] — delete a session (ADMIN only).
// Blocks deletion when any Allocation references this session name
// (via `Allocation.academicYear`).
export async function DELETE(_request: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const { id } = await ctx.params

  const existing = await db.academicSession.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Session not found" },
      { status: 404 },
    )
  }

  // Reference check: any Allocation with this academicYear?
  const referenceCount = await db.allocation.count({
    where: { academicYear: existing.name },
  })

  if (referenceCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot delete: ${referenceCount} allocation${
          referenceCount === 1 ? "" : "s"
        } reference this session.`,
      },
      { status: 409 },
    )
  }

  try {
    await db.academicSession.delete({ where: { id } })
    return NextResponse.json({
      success: true,
      message: `Session "${existing.name}" deleted.`,
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      )
    }
    throw err
  }
}
