import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user, newest first.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return NextResponse.json({
    success: true,
    data: notifications,
    unreadCount,
  })
}
