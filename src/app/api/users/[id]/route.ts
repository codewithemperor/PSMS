import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/users/[id] — fetch a single user with their profile
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const { id } = await params

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      matricNo: true,
      staffId: true,
      phone: true,
      isActive: true,
      createdAt: true,
      studentProfile: {
        select: {
          level: true,
          programme: true,
          supervisor: { select: { id: true, name: true } },
        },
      },
      supervisorProfile: {
        select: {
          currentLoad: true,
          maxStudents: true,
          specialization: true,
          bio: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, data: user })
}

const updateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// PUT /api/users/[id] — edit user (cannot change role)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
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

  // Verify target exists
  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  })
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 },
    )
  }

  // Email uniqueness check (if email changed)
  if (parsed.data.email && parsed.data.email !== existing.email) {
    const emailClash = await db.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: { id: true },
    })
    if (emailClash) {
      return NextResponse.json(
        { success: false, error: "Email is already in use" },
        { status: 409 },
      )
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.email && { email: parsed.data.email.toLowerCase() }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.department !== undefined && {
        department: parsed.data.department,
      }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      phone: true,
      isActive: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: updated,
    message: "User updated successfully",
  })
}

// DELETE /api/users/[id] — soft delete (set isActive = false)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const { id } = await params

  // Prevent self-deletion
  if (session.user.id === id) {
    return NextResponse.json(
      { success: false, error: "You cannot deactivate your own account" },
      { status: 400 },
    )
  }

  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, isActive: true, name: true },
  })
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 },
    )
  }

  const updated = await db.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: { id: true, isActive: true, name: true },
  })

  return NextResponse.json({
    success: true,
    message: `${updated.name} has been ${updated.isActive ? "activated" : "deactivated"}`,
    data: updated,
  })
}
