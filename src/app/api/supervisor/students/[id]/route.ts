import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/supervisor/students/[id] — full detail of a student for the supervisor
// Includes project + milestones + documents + feedback history + topics.
// Access: SUPERVISOR must have an ACTIVE allocation for this student.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    )
  }
  const { id } = await params
  const supervisorId = session.user.id

  // Verify allocation
  const allocation = await db.allocation.findFirst({
    where: { studentId: id, supervisorId, status: "ACTIVE" },
    select: {
      academicYear: true,
      semester: true,
      allocatedAt: true,
      allocatedBy: true,
    },
  })
  if (!allocation) {
    return NextResponse.json(
      { success: false, error: "Student is not allocated to you" },
      { status: 403 },
    )
  }

  const student = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      matricNo: true,
      department: true,
      phone: true,
      avatar: true,
      createdAt: true,
      studentProfile: {
        select: { level: true, programme: true, enrollmentYear: true },
      },
    },
  })
  if (!student) {
    return NextResponse.json(
      { success: false, error: "Student not found" },
      { status: 404 },
    )
  }

  const [project, topics, documents, feedback] = await Promise.all([
    db.project.findUnique({
      where: { studentId: id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        progress: true,
        startDate: true,
        expectedEndDate: true,
        submittedAt: true,
        approvedAt: true,
        milestones: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            order: true,
            weight: true,
            dueDate: true,
            completedDate: true,
          },
          orderBy: { order: "asc" },
        },
      },
    }),
    db.topic.findMany({
      where: { studentId: id },
      select: {
        id: true,
        title: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewerComment: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.document.findMany({
      where: { project: { studentId: id } },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        documentType: true,
        version: true,
        isFinal: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
        _count: { select: { feedback: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.feedback.findMany({
      where: { studentId: id },
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        document: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      student: {
        ...student,
        allocation,
      },
      project,
      topics,
      documents: documents.map((d) => ({
        ...d,
        feedbackCount: d._count.feedback,
      })),
      feedback,
    },
  })
}
