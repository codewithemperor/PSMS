import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// DELETE /api/allocations/[id] — revoke an allocation (set status = REVOKED)
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

  const allocation = await db.allocation.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } },
    },
  })

  if (!allocation) {
    return NextResponse.json(
      { success: false, error: "Allocation not found" },
      { status: 404 },
    )
  }

  if (allocation.status === "REVOKED") {
    return NextResponse.json(
      { success: false, error: "Allocation is already revoked" },
      { status: 400 },
    )
  }

  await db.$transaction(async (tx) => {
    // Revoke allocation
    await tx.allocation.update({
      where: { id },
      data: { status: "REVOKED" },
    })

    // Decrement supervisor's current load (don't go below 0)
    const profile = await tx.supervisorProfile.findUnique({
      where: { userId: allocation.supervisorId },
      select: { currentLoad: true },
    })
    if (profile && profile.currentLoad > 0) {
      await tx.supervisorProfile.update({
        where: { userId: allocation.supervisorId },
        data: { currentLoad: profile.currentLoad - 1 },
      })
    }

    // Unset student's supervisorId
    await tx.studentProfile.updateMany({
      where: { userId: allocation.studentId, supervisorId: allocation.supervisorId },
      data: { supervisorId: null },
    })

    // Notify student + supervisor
    await tx.notification.create({
      data: {
        title: "Allocation Revoked",
        message: `Your allocation to ${allocation.supervisor.name} has been revoked by the administrator.`,
        type: "WARNING",
        userId: allocation.studentId,
        link: "/student/dashboard",
      },
    })
    await tx.notification.create({
      data: {
        title: "Student Allocation Revoked",
        message: `${allocation.student.name}'s allocation to you has been revoked by the administrator.`,
        type: "INFO",
        userId: allocation.supervisorId,
        link: "/supervisor/students",
      },
    })
  })

  return NextResponse.json({
    success: true,
    message: "Allocation revoked successfully",
  })
}
