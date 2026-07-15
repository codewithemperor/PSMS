import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STUDENT", "SUPERVISOR"]),
  matricNo: z.string().optional(),
  staffId: z.string().optional(),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  // --- Admin-only guard ---
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Only admins can create users" },
      { status: 403 },
    )
  }

  // --- Parse + validate ---
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
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
  const data = parsed.data

  // --- Role-specific field requirements ---
  if (data.role === "STUDENT" && !data.matricNo) {
    return NextResponse.json(
      { success: false, error: "matricNo is required for students" },
      { status: 400 },
    )
  }
  if (data.role === "SUPERVISOR" && !data.staffId) {
    return NextResponse.json(
      { success: false, error: "staffId is required for supervisors" },
      { status: 400 },
    )
  }

  // --- Uniqueness checks ---
  const emailExists = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
    select: { id: true },
  })
  if (emailExists) {
    return NextResponse.json(
      { success: false, error: "A user with this email already exists" },
      { status: 409 },
    )
  }
  if (data.matricNo) {
    const m = await db.user.findUnique({
      where: { matricNo: data.matricNo },
      select: { id: true },
    })
    if (m) {
      return NextResponse.json(
        { success: false, error: "This matric number is already in use" },
        { status: 409 },
      )
    }
  }
  if (data.staffId) {
    const s = await db.user.findUnique({
      where: { staffId: data.staffId },
      select: { id: true },
    })
    if (s) {
      return NextResponse.json(
        { success: false, error: "This staff ID is already in use" },
        { status: 409 },
      )
    }
  }

  // --- Create user (+ profile) ---
  const passwordHash = await bcrypt.hash(data.password, 10)
  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      password: passwordHash,
      name: data.name,
      role: data.role,
      matricNo: data.matricNo,
      staffId: data.staffId,
      phone: data.phone,
      studentProfile:
        data.role === "STUDENT"
          ? { create: { level: "400" } }
          : undefined,
      supervisorProfile:
        data.role === "SUPERVISOR"
          ? {
              create: {
                maxStudents: 5,
                currentLoad: 0,
              },
            }
          : undefined,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      matricNo: true,
      staffId: true,
      phone: true,
      createdAt: true,
    },
  })

  return NextResponse.json(
    { success: true, data: user, message: "User created successfully" },
    { status: 201 },
  )
}
