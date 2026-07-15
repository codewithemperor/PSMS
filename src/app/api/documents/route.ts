import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// GET /api/documents — role-filtered document list
// - ADMIN: all documents
// - SUPERVISOR: documents uploaded by their allocated students
// - STUDENT: their own uploaded documents
// Supports: search, documentType, status=reviewed|pending|final, page, limit
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const docType = url.searchParams.get("documentType")
  const statusFilter = url.searchParams.get("status") // "pending" | "reviewed" | "final"
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)),
  )

  // Build the where clause by role
  let where: Prisma.DocumentWhereInput = {}

  if (session.user.role === "STUDENT") {
    where.uploadedById = session.user.id
  } else if (session.user.role === "SUPERVISOR") {
    where.project = { supervisorId: session.user.id }
  }
  // ADMIN sees all

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { fileName: { contains: search } },
    ]
  }
  if (
    docType &&
    [
      "PROPOSAL",
      "DRAFT",
      "LITERATURE_REVIEW",
      "METHODOLOGY",
      "DATA_ANALYSIS",
      "FINAL_REPORT",
      "OTHER",
    ].includes(docType)
  ) {
    where.documentType = docType as Prisma.DocumentWhereInput["documentType"]
  }
  if (statusFilter === "final") {
    where.isFinal = true
  }

  const [total, documents] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        documentType: true,
        version: true,
        isFinal: true,
        createdAt: true,
        uploadedBy: {
          select: { id: true, name: true, email: true, matricNo: true },
        },
        project: {
          select: {
            id: true,
            title: true,
            student: { select: { id: true, name: true } },
          },
        },
        feedback: {
          select: {
            id: true,
            content: true,
            status: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ])

  // Apply "pending"/"reviewed" status filter (post-query since it's based on feedback presence)
  let filtered = documents
  if (statusFilter === "pending") {
    filtered = documents.filter((d) => d.feedback.length === 0)
  } else if (statusFilter === "reviewed") {
    filtered = documents.filter((d) => d.feedback.length > 0)
  }

  return NextResponse.json({
    success: true,
    data: filtered,
    pagination: {
      page,
      limit,
      total: statusFilter === "pending" || statusFilter === "reviewed"
        ? filtered.length
        : total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
}
