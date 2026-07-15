import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * PATCH /api/notifications/read-all
 * Marks every unread notification as read for the authenticated user.
 */
export async function PATCH() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const result = await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({
    success: true,
    message: `${result.count} notifications marked as read`,
  })
}
