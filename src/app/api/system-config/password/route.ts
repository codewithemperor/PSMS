import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const admin = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  })
  if (!admin) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, admin.password)
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    )
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 10)
  await db.user.update({
    where: { id: admin.id },
    data: { password: hash },
  })

  return NextResponse.json({ success: true })
}
