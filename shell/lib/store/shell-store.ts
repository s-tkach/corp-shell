"use client";

import { create } from "zustand";

interface ShellStore {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useShellStore = create<ShellStore>((set, get) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
}));
