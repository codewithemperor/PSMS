import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  // --- Admin-only guard ---
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  // --- Parse query params ---
  const url = new URL(request.url)
  const role = url.searchParams.get("role")
  const search = url.searchParams.get("search")?.trim() ?? ""
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
  )

  // --- Build where clause ---
  const where: Prisma.UserWhereInput = {}
  if (role && ["ADMIN", "SUPERVISOR", "STUDENT"].includes(role)) {
    where.role = role as Prisma.UserWhereInput["role"]
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { matricNo: { contains: search } },
      { staffId: { contains: search } },
    ]
  }

  // --- Fetch paginated ---
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
            supervisor: { select: { name: true } },
          },
        },
        supervisorProfile: {
          select: {
            currentLoad: true,
            maxStudents: true,
            specialization: true,
          },
        },
      },
    }),
  ])

  // --- Shape response ---
  const data = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    matricNo: u.matricNo,
    staffId: u.staffId,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt,
    level: u.studentProfile?.level ?? null,
    programme: u.studentProfile?.programme ?? null,
    supervisorName: u.studentProfile?.supervisor?.name ?? null,
    currentLoad: u.supervisorProfile?.currentLoad ?? null,
    maxStudents: u.supervisorProfile?.maxStudents ?? null,
    specialization: u.supervisorProfile?.specialization ?? null,
  }))

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
}
