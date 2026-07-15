"use client"

import { create } from "zustand"
import type { INotification } from "@/types"

interface NotificationState {
  notifications: INotification[]
  unreadCount: number
  isLoading: boolean
  setNotifications: (list: INotification[]) => void
  addNotification: (notification: INotification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  setUnreadCount: (count: number) => void
  decrementUnreadCount: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  setNotifications: (list) =>
    set({
      notifications: list,
      unreadCount: list.filter((n) => !n.isRead).length,
      isLoading: false,
    }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    })),
  markAsRead: (id) =>
    set((state) => {
      const wasUnread = state.notifications.find(
        (n) => n.id === id && !n.isRead,
      )
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        ),
        unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
      }
    }),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    })),
  setUnreadCount: (count) => set({ unreadCount: count }),
  decrementUnreadCount: () =>
    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
}))
