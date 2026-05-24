"use client";

import React, { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "./notification-provider";
import { useShellStore } from "@/lib/store/shell-store";
import type { NotificationItem, ToastConfig } from "./notification-provider";

function Toast({
  notification,
  onDismiss,
  config,
}: {
  notification: NotificationItem;
  onDismiss: () => void;
  config: ToastConfig;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, config.duration);
    return () => clearTimeout(timer);
  }, [onDismiss, config.duration]);

  return (
    <div
      className="flex items-start gap-3 rounded-lg border shadow-lg p-3 w-80 pointer-events-auto"
      style={{
        background: config.bgColor,
        color: config.textColor,
        borderColor: config.borderColor,
      }}
    >
      <Bell className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: config.textColor, opacity: 0.6 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{notification.title}</p>
        <p className="text-xs line-clamp-2" style={{ color: config.textColor, opacity: 0.6 }}>{notification.body}</p>
        {notification.actionLabel && notification.actionPayload && (
          <a
            href={notification.actionPayload}
            className="text-xs hover:underline mt-1 inline-block"
            style={{ color: config.textColor }}
          >
            {notification.actionLabel}
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0"
        style={{ color: config.textColor, opacity: 0.5 }}
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function positionStyle(position: string, sidebarCollapsed: boolean): React.CSSProperties {
  const sidebarWidth = sidebarCollapsed ? 64 : 256;
  const headerHeight = 56;
  const gap = 16;

  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");

  return {
    top: isTop ? headerHeight + gap : "auto",
    bottom: isTop ? "auto" : gap,
    left: isLeft ? sidebarWidth + gap : "auto",
    right: isLeft ? "auto" : gap,
  };
}

export function NotificationToastStack() {
  const { toasts, dismissToast, toastConfig } = useNotifications();
  const sidebarCollapsed = useShellStore((s) => s.sidebarCollapsed);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed flex flex-col gap-2 z-50 pointer-events-none"
      style={positionStyle(toastConfig.position, sidebarCollapsed)}
    >
      {toasts.map((t) => (
        <Toast key={t.id} notification={t} onDismiss={() => dismissToast(t.id)} config={toastConfig} />
      ))}
    </div>
  );
}
