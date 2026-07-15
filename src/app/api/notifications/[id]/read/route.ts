import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * PATCH /api/notifications/[id]/read
 * Marks a single notification as read for the authenticated user.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const { id } = await params

  // Ensure the notification belongs to this user
  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "Notification not found" },
      { status: 404 },
    )
  }

  const updated = await db.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true, data: updated })
}
