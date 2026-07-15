import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
// force recompile trigger
import { Prisma } from "@prisma/client"

// GET /api/sessions — list all academic sessions (any authenticated user).
// Ordered by name DESC (newest first).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const sessions = await db.academicSession.findMany({
    orderBy: { name: "desc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: sessions })
}

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Session name is required")
    .max(50, "Session name is too long"),
})

// POST /api/sessions — create a new academic session (ADMIN only).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
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

  const { name } = parsed.data

  try {
    const created = await db.academicSession.create({
      data: { name },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    // Unique constraint violation (P2002): name already exists
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
    throw err
  }
}
