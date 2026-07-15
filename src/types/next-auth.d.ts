import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: "ADMIN" | "SUPERVISOR" | "STUDENT"
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: "ADMIN" | "SUPERVISOR" | "STUDENT"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    email?: string
    name?: string
    role?: string
  }
}
