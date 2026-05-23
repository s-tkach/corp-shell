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
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: NotificationItem[];
  dismissToast: (id: string) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <NotificationsContext.Provider
      value={{ notifications: notifs, unreadCount, toasts, dismissToast, markRead, markAllRead, refresh }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
