"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useShellStore } from "@/lib/store/shell-store";

export interface ToastConfig {
  position: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  duration: number;
}

export const DEFAULT_TOAST_CONFIG: ToastConfig = {
  position: "bottom-right",
  bgColor: "#ffffff",
  textColor: "#020817",
  borderColor: "#e2e8f0",
  duration: 5000,
};

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  actionLabel: string | null;
  actionType: string | null;
  actionPayload: string | null;
  targetType: string;
  targetUserId: string | null;
  targetSubLevel: number | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  isRead: boolean;
  variant?: ToastVariant;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: NotificationItem[];
  toastConfig: ToastConfig;
  dismissToast: (id: string) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  showToast: (toast: { title: string; body?: string; variant?: ToastVariant }) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

export function NotificationProvider({ children, toastConfig = DEFAULT_TOAST_CONFIG }: { children: React.ReactNode; toastConfig?: ToastConfig }) {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const setUnreadCount = useShellStore((s) => s.setUnreadCount);
  const incrementUnreadCount = useShellStore((s) => s.incrementUnreadCount);
  const unreadCount = useShellStore((s) => s.unreadCount);
  const retryDelay = useRef(1000);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json() as { notifications: NotificationItem[] };
    setNotifs(data.notifications);
    setUnreadCount(data.notifications.filter((n) => !n.isRead).length);
  }, [setUnreadCount]);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;

    es.addEventListener("notification", (e: MessageEvent) => {
      const incoming = JSON.parse(e.data as string) as NotificationItem;
      incoming.isRead = false;
      setNotifs((prev) => [incoming, ...prev]);
      setToasts((prev) => {
        const next = [incoming, ...prev];
        return next.slice(0, 3);
      });
      incrementUnreadCount();
      retryDelay.current = 1000;
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      const delay = retryDelay.current;
      retryDelay.current = Math.min(delay * 2, 30_000);
      setTimeout(connect, delay);
    };
  }, [incrementUnreadCount]);

  useEffect(() => {
    void refresh();
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [refresh, connect]);

  const markRead = useCallback(
    async (id: string) => {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (!res.ok) return;
      const { unreadCount } = await res.json() as { unreadCount: number };
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(unreadCount);
    },
    [setUnreadCount]
  );

  const markAllRead = useCallback(async () => {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: "all" }),
    });
    if (!res.ok) return;
    const { unreadCount } = await res.json() as { unreadCount: number };
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(unreadCount);
  }, [setUnreadCount]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, body, variant }: { title: string; body?: string; variant?: ToastVariant }) => {
      const id = crypto.randomUUID();
      const item: NotificationItem = {
        id,
        title,
        body: body ?? "",
        actionLabel: null,
        actionType: null,
        actionPayload: null,
        targetType: "all",
        targetUserId: null,
        targetSubLevel: null,
        expiresAt: null,
        createdBy: "",
        createdAt: new Date().toISOString(),
        isRead: true,
        variant,
      };
      setToasts((prev) => [item, ...prev].slice(0, 3));
      setTimeout(() => dismissToast(id), toastConfig.duration);
    },
    [dismissToast, toastConfig.duration]
  );

  return (
    <NotificationsContext.Provider
      value={{ notifications: notifs, unreadCount, toasts, toastConfig, dismissToast, markRead, markAllRead, refresh, showToast }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
