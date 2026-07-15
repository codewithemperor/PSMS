import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SECRET =
  process.env.NEXTAUTH_SECRET || "psms-dev-secret-change-in-production"

const DASHBOARD_MAP: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  SUPERVISOR: "/supervisor/dashboard",
  STUDENT: "/student/dashboard",
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = await getToken({ req: request, secret: SECRET })

  // --- Root "/" : the login page ---
  if (pathname === "/") {
    if (token?.role) {
      return NextResponse.redirect(
        new URL(DASHBOARD_MAP[token.role as string] || "/", request.url),
      )
    }
    return NextResponse.next()
  }

  // --- Role-protected routes ---
  let requiredRole: string | null = null
  if (pathname.startsWith("/admin")) requiredRole = "ADMIN"
  else if (pathname.startsWith("/supervisor")) requiredRole = "SUPERVISOR"
  else if (pathname.startsWith("/student")) requiredRole = "STUDENT"

  if (requiredRole) {
    // Not authenticated → login
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    // Authenticated but wrong role → their own dashboard
    if (token.role !== requiredRole) {
      return NextResponse.redirect(
        new URL(DASHBOARD_MAP[token.role as string] || "/", request.url),
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/admin/:path*", "/supervisor/:path*", "/student/:path*"],
}
