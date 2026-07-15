import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/supervisors — list of active supervisors (for student topic form)
// Returns id, name, specialization, currentLoad, maxStudents, department.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const supervisors = await db.user.findMany({
    where: { role: "SUPERVISOR", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      supervisorProfile: {
        select: {
          specialization: true,
          maxStudents: true,
          currentLoad: true,
          bio: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  const data = supervisors.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    department: s.department,
    specialization: s.supervisorProfile?.specialization ?? null,
    maxStudents: s.supervisorProfile?.maxStudents ?? 5,
    currentLoad: s.supervisorProfile?.currentLoad ?? 0,
    bio: s.supervisorProfile?.bio ?? null,
    available:
      (s.supervisorProfile?.currentLoad ?? 0) <
      (s.supervisorProfile?.maxStudents ?? 5),
  }))

  return NextResponse.json({ success: true, data })
}
