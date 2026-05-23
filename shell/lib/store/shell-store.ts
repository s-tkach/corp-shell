"use client";

import { create } from "zustand";

interface ShellStore {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  incrementUnreadCount: () => void;
}

export const useShellStore = create<ShellStore>((set, get) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnreadCount: () => set({ unreadCount: get().unreadCount + 1 }),
}));
