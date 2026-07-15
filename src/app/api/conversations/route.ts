import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/conversations
 *
 * Returns the list of conversation partners for the authenticated user,
 * each with the latest message preview and an unread count.
 *
 * Response shape (per the Phase 6 spec):
 *   {
 *     success: true,
 *     data: [
 *       {
 *         userId, name, role,
 *         lastMessage: { content, createdAt },
 *         unreadCount
 *       }
 *     ]
 *   }
 *
 * Ordered by lastMessage.createdAt DESC.
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

  // Fetch every message involving the user. We'll dedupe partners in JS so
  // we can compute both the latest message and the unread count in one pass.
  const messages = await db.message.findMany({
    where: {
      OR: [{ senderId: meId }, { receiverId: meId }],
    },
    select: {
      id: true,
      content: true,
      senderId: true,
      receiverId: true,
      isRead: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  type PartnerAgg = {
    lastMessage: { content: string; createdAt: Date }
    unreadCount: number
  }
  const partners = new Map<string, PartnerAgg>()

  for (const m of messages) {
    const partnerId = m.senderId === meId ? m.receiverId : m.senderId
    const isReceived = m.receiverId === meId
    const unreadDelta = isReceived && !m.isRead ? 1 : 0

    const existing = partners.get(partnerId)
    if (!existing) {
      partners.set(partnerId, {
        lastMessage: { content: m.content, createdAt: m.createdAt },
        unreadCount: unreadDelta,
      })
      continue
    }

    // Messages come in ascending order so each later message is "newer".
    existing.lastMessage = { content: m.content, createdAt: m.createdAt }
    existing.unreadCount += unreadDelta
  }

  const partnerIds = Array.from(partners.keys())
  if (partnerIds.length === 0) {
    return NextResponse.json({ success: true, data: [] })
  }

  const partnerUsers = await db.user.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true, role: true },
  })

  const data = partnerUsers
    .map((u) => {
      const agg = partners.get(u.id)
      if (!agg) return null
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        lastMessage: {
          content: agg.lastMessage.content,
          createdAt: agg.lastMessage.createdAt.toISOString(),
        },
        unreadCount: agg.unreadCount,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    )

  return NextResponse.json({ success: true, data })
}
