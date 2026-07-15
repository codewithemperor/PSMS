import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/contacts
 *
 * Returns the list of users the authenticated user is allowed to start a
 * new conversation with. Role-scoped so the New Message dialog shows the
 * right people per role:
 *
 *   ADMIN      → all active users except self (students + supervisors + other admins)
 *   SUPERVISOR → their allocated students (ACTIVE allocations) + all active admins
 *   STUDENT    → their supervisor (via ACTIVE allocation) + all active admins
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: [{ id, name, email, role, department }]
 *   }
 *
 * Admins are universally messageable, so they appear in every non-admin
 * user's contact list. This complements the message guards in
 * `src/app/api/messages/route.ts` which allow messaging an admin from any
 * role.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const meId = session.user.id
  const role = session.user.role

  const select = {
    id: true,
    name: true,
    email: true,
    role: true,
    department: true,
  } as const

  if (role === "ADMIN") {
    // Admin can message anyone active except themselves.
    const users = await db.user.findMany({
      where: { id: { not: meId }, isActive: true },
      select,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })
    return NextResponse.json({ success: true, data: users })
  }

  if (role === "SUPERVISOR") {
    // 1. Students allocated to this supervisor (active allocations).
    const allocations = await db.allocation.findMany({
      where: { supervisorId: meId, status: "ACTIVE" },
      select: { studentId: true },
    })
    const studentIds = allocations.map((a) => a.studentId)

    const [students, admins] = await Promise.all([
      db.user.findMany({
        where: { id: { in: studentIds }, isActive: true },
        select,
        orderBy: { name: "asc" },
      }),
      db.user.findMany({
        where: { role: "ADMIN", id: { not: meId }, isActive: true },
        select,
        orderBy: { name: "asc" },
      }),
    ])

    // Stable dedupe by id (defensive — ids shouldn't overlap between the two sets).
    const seen = new Set<string>()
    const data = [...students, ...admins].filter((u) => {
      if (seen.has(u.id)) return false
      seen.add(u.id)
      return true
    })
    return NextResponse.json({ success: true, data })
  }

  // STUDENT
  // 1. Their supervisor (via ACTIVE allocation).
  const allocation = await db.allocation.findFirst({
    where: { studentId: meId, status: "ACTIVE" },
    select: { supervisorId: true },
  })

  const supervisorId = allocation?.supervisorId ?? null
  const [supervisor, admins] = await Promise.all([
    supervisorId
      ? db.user.findFirst({
          where: { id: supervisorId, isActive: true },
          select,
        })
      : Promise.resolve(null),
    db.user.findMany({
      where: { role: "ADMIN", id: { not: meId }, isActive: true },
      select,
      orderBy: { name: "asc" },
    }),
  ])

  const data = [supervisor, ...admins].filter(
    (u): u is NonNullable<typeof u> => u !== null,
  )
  return NextResponse.json({ success: true, data })
}
