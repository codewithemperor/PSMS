"use client"

import { create } from "zustand"
import type { UserRole } from "@/types"

interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  department?: string | null
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: AuthUser) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

/**
 * Minimal auth store.
 *
 * NOTE: There is deliberately NO currentView / selectedStudentId /
 * selectedProjectId / selectedConversationId here. All navigation state comes
 * from Next.js URL routing. This store only mirrors the NextAuth session so
 * client components can read the current user without re-calling getSession.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))
