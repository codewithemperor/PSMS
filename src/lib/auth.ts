import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

/**
 * NextAuth v4 configuration for PSMS.
 *
 * - Credentials provider (email + password) validated against the Prisma User table
 * - JWT session strategy (simplest for SQLite, no adapter needed)
 * - jwt + session callbacks carry id / email / name / role onto the token & session
 * - signIn page is the root "/" route (the login form)
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        // No user found or account deactivated
        if (!user || !user.isActive) return null

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.password,
        )
        if (!passwordValid) return null

        // Return the shape that the jwt callback receives as `user`
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/",
  },

  secret: process.env.NEXTAUTH_SECRET || "psms-dev-secret-change-in-production",

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.email = (user as { email?: string }).email ?? token.email
        token.name = (user as { name?: string }).name ?? token.name
        token.role = (user as { role: string }).role
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = (token.email as string) ?? session.user.email
        session.user.name = (token.name as string) ?? session.user.name
        session.user.role = token.role as
          | "ADMIN"
          | "SUPERVISOR"
          | "STUDENT"
      }
      return session
    },
  },
}
