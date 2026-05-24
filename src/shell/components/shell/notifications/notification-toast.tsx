"use client";

import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "./notification-provider";
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

function positionClasses(position: string): string {
  switch (position) {
    case "bottom-left": return "bottom-4 left-4";
    case "top-right": return "top-4 right-4";
    case "top-left": return "top-4 left-4";
    default: return "bottom-4 right-4";
  }
}

export function NotificationToastStack() {
  const { toasts, dismissToast, toastConfig } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className={`fixed flex flex-col gap-2 z-50 pointer-events-none ${positionClasses(toastConfig.position)}`}>
      {toasts.map((t) => (
        <Toast key={t.id} notification={t} onDismiss={() => dismissToast(t.id)} config={toastConfig} />
      ))}
    </div>
  );
}
