import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/users/me — current user's full profile
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      phone: true,
      avatar: true,
      matricNo: true,
      staffId: true,
      createdAt: true,
      studentProfile: {
        select: { level: true, programme: true, enrollmentYear: true },
      },
      supervisorProfile: {
        select: {
          specialization: true,
          maxStudents: true,
          currentLoad: true,
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

// PATCH /api/users/me — update own profile (name, phone, department, avatar)
// Email + role + matricNo/staffId are not editable here.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  let body: {
    name?: string
    phone?: string
    department?: string
    avatar?: string
    bio?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const updates: {
    name?: string
    phone?: string
    department?: string
    avatar?: string
  } = {}

  if (body.name !== undefined) {
    if (body.name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Name must be at least 2 characters" },
        { status: 400 },
      )
    }
    updates.name = body.name.trim()
  }
  if (body.phone !== undefined) {
    updates.phone = body.phone.trim() || null
  }
  if (body.department !== undefined) {
    updates.department = body.department.trim() || null
  }
  if (body.avatar !== undefined) {
    updates.avatar = body.avatar.trim() || null
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: updates,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      phone: true,
      avatar: true,
    },
  })

  // Update supervisor bio if provided
  if (body.bio !== undefined && session.user.role === "SUPERVISOR") {
    await db.supervisorProfile.update({
      where: { userId: session.user.id },
      data: { bio: body.bio.trim() || null },
    })
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: "Profile updated",
  })
}
