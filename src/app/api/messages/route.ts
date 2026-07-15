import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { publishToUser } from "@/lib/realtime"

// GET /api/messages — conversation list or single conversation
// Query params:
//   - conversationWith=<userId>  → returns messages between session user and that user (legacy alias)
//   - userId=<userId>            → same as conversationWith (spec-compliant param name)
//   - projectId=<projectId>?     → optional filter when fetching a single conversation
//   - (none)                     → returns list of conversations (latest message per partner)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const userId = session.user.id

  const url = new URL(request.url)
  // `userId` query param is the spec's name; `conversationWith` is the
  // pre-existing alias. Either works.
  const conversationWith =
    url.searchParams.get("userId") ??
    url.searchParams.get("conversationWith")
  const projectId = url.searchParams.get("projectId")

  if (conversationWith) {
    // Verify the partner is allowed:
    // - student  → supervisor (via Allocation) OR any ADMIN
    // - supervisor → allocated students (via Allocation) OR any ADMIN
    // - admin → anyone
    // Admins are universally messageable.
    if (session.user.role === "STUDENT" || session.user.role === "SUPERVISOR") {
      const partner = await db.user.findFirst({
        where: { id: conversationWith },
        select: { role: true },
      })
      const isPartnerAdmin = partner?.role === "ADMIN"
      if (!isPartnerAdmin) {
        if (session.user.role === "STUDENT") {
          const alloc = await db.allocation.findFirst({
            where: { studentId: userId, supervisorId: conversationWith, status: "ACTIVE" },
            select: { id: true },
          })
          if (!alloc) {
            return NextResponse.json(
              { success: false, error: "You can only message your supervisor or an admin" },
              { status: 403 },
            )
          }
        } else {
          const alloc = await db.allocation.findFirst({
            where: { supervisorId: userId, studentId: conversationWith, status: "ACTIVE" },
            select: { id: true },
          })
          if (!alloc) {
            return NextResponse.json(
              { success: false, error: "You can only message your allocated students or an admin" },
              { status: 403 },
            )
          }
        }
      }
    }

    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: conversationWith },
          { senderId: conversationWith, receiverId: userId },
        ],
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        senderId: true,
        receiverId: true,
        isRead: true,
        createdAt: true,
      },
      take: 200,
    })

    // Mark received messages as read
    const readResult = await db.message.updateMany({
      where: { senderId: conversationWith, receiverId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    // If we just flipped any messages to read, notify the partner in real time
    // so their sent-bubbles' read receipts update without a refetch.
    if (readResult.count > 0) {
      void publishToUser(conversationWith, "messages_read", { userId })
    }

    return NextResponse.json({ success: true, data: messages })
  }

  // Conversation list: find all unique partners
  const sent = await db.message.findMany({
    where: { senderId: userId },
    select: {
      receiverId: true,
      content: true,
      createdAt: true,
      isRead: true,
    },
    orderBy: { createdAt: "desc" },
  })
  const received = await db.message.findMany({
    where: { receiverId: userId },
    select: {
      senderId: true,
      content: true,
      createdAt: true,
      isRead: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Build a map of partnerId → { lastMessage, lastAt, unreadCount }
  const partners = new Map<
    string,
    { lastMessage: string; lastAt: Date; unreadCount: number }
  >()

  for (const m of sent) {
    const existing = partners.get(m.receiverId)
    if (!existing || new Date(m.createdAt) > existing.lastAt) {
      partners.set(m.receiverId, {
        lastMessage: m.content,
        lastAt: m.createdAt,
        unreadCount: existing?.unreadCount ?? 0,
      })
    }
  }
  for (const m of received) {
    const existing = partners.get(m.senderId)
    const isNewer = !existing || new Date(m.createdAt) > existing.lastAt
    partners.set(m.senderId, {
      lastMessage: isNewer ? m.content : existing!.lastMessage,
      lastAt: isNewer ? m.createdAt : existing!.lastAt,
      unreadCount: (existing?.unreadCount ?? 0) + (m.isRead ? 0 : 1),
    })
  }

  const partnerIds = Array.from(partners.keys())
  if (partnerIds.length === 0) {
    return NextResponse.json({ success: true, data: [] })
  }

  const partnerUsers = await db.user.findMany({
    where: { id: { in: partnerIds } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
    },
  })

  const data = partnerUsers
    .map((u) => {
      const p = partners.get(u.id)!
      return {
        partnerId: u.id,
        partnerName: u.name,
        partnerEmail: u.email,
        partnerRole: u.role,
        partnerDepartment: u.department,
        lastMessage: p.lastMessage,
        lastAt: p.lastAt,
        unreadCount: p.unreadCount,
      }
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

  return NextResponse.json({ success: true, data })
}

// POST /api/messages — send a message
// Body: { receiverId, content, projectId? }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const senderId = session.user.id

  let body: { receiverId?: string; content?: string; projectId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const { receiverId, content, projectId } = body
  if (!receiverId) {
    return NextResponse.json(
      { success: false, error: "receiverId is required" },
      { status: 400 },
    )
  }
  if (!content?.trim() || content.trim().length < 1) {
    return NextResponse.json(
      { success: false, error: "Message content is required" },
      { status: 400 },
    )
  }
  if (receiverId === senderId) {
    return NextResponse.json(
      { success: false, error: "Cannot send a message to yourself" },
      { status: 400 },
    )
  }

  // Authorization:
  //   student    → supervisor (via Allocation) OR any ADMIN
  //   supervisor → allocated students (via Allocation) OR any ADMIN
  //   admin      → anyone
  // Admins are universally messageable.
  if (session.user.role === "STUDENT" || session.user.role === "SUPERVISOR") {
    // Look up the receiver once — used both for the role check and the
    // existence check below.
    const receiver = await db.user.findFirst({
      where: { id: receiverId, isActive: true },
      select: { id: true, name: true, role: true },
    })
    if (!receiver) {
      return NextResponse.json(
        { success: false, error: "Receiver not found" },
        { status: 404 },
      )
    }
    if (receiver.role !== "ADMIN") {
      const alloc =
        session.user.role === "STUDENT"
          ? await db.allocation.findFirst({
              where: { studentId: senderId, supervisorId: receiverId, status: "ACTIVE" },
              select: { id: true },
            })
          : await db.allocation.findFirst({
              where: { supervisorId: senderId, studentId: receiverId, status: "ACTIVE" },
              select: { id: true },
            })
      if (!alloc) {
        return NextResponse.json(
          {
            success: false,
            error:
              session.user.role === "STUDENT"
                ? "You can only message your supervisor or an admin"
                : "You can only message your allocated students or an admin",
          },
          { status: 403 },
        )
      }
    }
  } else {
    // Admin — just verify the receiver exists.
    const receiver = await db.user.findFirst({
      where: { id: receiverId, isActive: true },
      select: { id: true, name: true },
    })
    if (!receiver) {
      return NextResponse.json(
        { success: false, error: "Receiver not found" },
        { status: 404 },
      )
    }
  }

  const message = await db.message.create({
    data: {
      content: content.trim(),
      senderId,
      receiverId,
      projectId: projectId ?? null,
      isRead: false,
    },
    select: {
      id: true,
      content: true,
      senderId: true,
      receiverId: true,
      isRead: true,
      createdAt: true,
      sender: { select: { name: true } },
    },
  })

  // Push the new message to the recipient in real time (best-effort). The
  // payload matches the old Socket.IO `receive_message` shape so the UI
  // handler is unchanged.
  void publishToUser(receiverId, "receive_message", {
    id: message.id,
    senderId: message.senderId,
    senderName: message.sender.name,
    receiverId: message.receiverId,
    content: message.content,
    projectId: projectId ?? null,
    createdAt: message.createdAt.toISOString(),
    isRead: message.isRead,
  })

  return NextResponse.json(
    {
      success: true,
      data: message,
      message: "Message sent",
    },
    { status: 201 },
  )
}
