// PSMS — Shared TypeScript types & interfaces (Phase 1)
// These mirror the Prisma models but use plain string-literal unions
// instead of imported Prisma enums, so they are safe to use on the client.

// ---------------------------------------------------------------------------
// Enum-like unions
// ---------------------------------------------------------------------------

export type UserRole = "ADMIN" | "SUPERVISOR" | "STUDENT"

export type ProjectStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"

export type TopicStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUIRED"

export type DocumentType =
  | "PROPOSAL"
  | "DRAFT"
  | "LITERATURE_REVIEW"
  | "METHODOLOGY"
  | "DATA_ANALYSIS"
  | "FINAL_REPORT"
  | "OTHER"

export type MilestoneStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE"

export type FeedbackStatus = "PENDING" | "ADDRESSED" | "DISMISSED"

export type NotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "TOPIC_SUBMITTED"
  | "TOPIC_APPROVED"
  | "TOPIC_REJECTED"
  | "DOCUMENT_UPLOADED"
  | "FEEDBACK_GIVEN"
  | "MILESTONE_COMPLETED"
  | "MILESTONE_DUE"
  | "ALLOCATION_ASSIGNED"

export type AllocationStatus = "ACTIVE" | "REVOKED"

export type MessageStatus = "SENT" | "DELIVERED" | "READ"

// ---------------------------------------------------------------------------
// Generic API helpers
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface DashboardStats {
  totalStudents: number
  totalSupervisors: number
  totalProjects: number
  projectsInProgress: number
  projectsCompleted: number
  pendingTopics: number
  overdueMilestones: number
  averageProgress: number
}

// ---------------------------------------------------------------------------
// Model interfaces
// ---------------------------------------------------------------------------

export interface IUser {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string | null
  department?: string | null
  matricNo?: string | null
  staffId?: string | null
  phone?: string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface IStudentProfile {
  id: string
  userId: string
  level: string
  programme?: string | null
  supervisorId?: string | null
  enrollmentYear?: number | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ISupervisorProfile {
  id: string
  userId: string
  specialization?: string | null
  maxStudents: number
  currentLoad: number
  bio?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface IProject {
  id: string
  title: string
  description?: string | null
  studentId: string
  supervisorId: string
  status: ProjectStatus
  startDate?: Date | string | null
  expectedEndDate?: Date | string | null
  submittedAt?: Date | string | null
  approvedAt?: Date | string | null
  progress: number
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ITopic {
  id: string
  title: string
  description: string
  studentId: string
  supervisorId: string
  projectId?: string | null
  status: TopicStatus
  submittedAt: Date | string
  reviewedAt?: Date | string | null
  reviewerComment?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface IDocument {
  id: string
  title: string
  description?: string | null
  fileName: string
  fileSize: number
  fileType: string
  filePath: string
  version: number
  documentType: DocumentType
  projectId: string
  uploadedById: string
  isFinal: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface IMilestone {
  id: string
  name: string
  description?: string | null
  projectId: string
  dueDate?: Date | string | null
  completedDate?: Date | string | null
  status: MilestoneStatus
  order: number
  weight: number
  createdAt: Date | string
  updatedAt: Date | string
}

export interface IFeedback {
  id: string
  content: string
  documentId?: string | null
  projectId: string
  authorId: string
  studentId: string
  status: FeedbackStatus
  createdAt: Date | string
  updatedAt: Date | string
}

export interface IMessage {
  id: string
  content: string
  senderId: string
  receiverId: string
  projectId?: string | null
  isRead: boolean
  readAt?: Date | string | null
  createdAt: Date | string
}

export interface INotification {
  id: string
  title: string
  message: string
  type: NotificationType
  userId: string
  link?: string | null
  isRead: boolean
  readAt?: Date | string | null
  createdAt: Date | string
}

export interface IAllocation {
  id: string
  studentId: string
  supervisorId: string
  academicYear: string
  semester: string
  status: AllocationStatus
  allocatedBy: string
  allocatedAt: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}

// ---------------------------------------------------------------------------
// Convenience: session user shape (used once Phase 2 lands NextAuth)
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string | null
  department?: string | null
}
