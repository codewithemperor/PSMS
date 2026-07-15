import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// GET /api/allocations — list allocations (admin) with filters
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const supervisorId = url.searchParams.get("supervisorId")
  const academicYear = url.searchParams.get("academicYear")

  const where: Prisma.AllocationWhereInput = {}
  if (status && ["ACTIVE", "REVOKED"].includes(status)) {
    where.status = status as Prisma.AllocationWhereInput["status"]
  }
  if (supervisorId) where.supervisorId = supervisorId
  if (academicYear) where.academicYear = academicYear

  const allocations = await db.allocation.findMany({
    where,
    orderBy: { allocatedAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          matricNo: true,
          department: true,
          studentProfile: { select: { level: true, programme: true } },
        },
      },
      supervisor: {
        select: {
          id: true,
          name: true,
          email: true,
          supervisorProfile: {
            select: { specialization: true, maxStudents: true, currentLoad: true },
          },
        },
      },
    },
  })

  const data = allocations.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    studentName: a.student.name,
    studentEmail: a.student.email,
    studentMatricNo: a.student.matricNo,
    studentDepartment: a.student.department,
    studentLevel: a.student.studentProfile?.level ?? null,
    supervisorId: a.supervisorId,
    supervisorName: a.supervisor.name,
    supervisorEmail: a.supervisor.email,
    supervisorSpecialization: a.supervisor.supervisorProfile?.specialization ?? null,
    academicYear: a.academicYear,
    semester: a.semester,
    status: a.status,
    allocatedAt: a.allocatedAt,
  }))

  return NextResponse.json({ success: true, data })
}
