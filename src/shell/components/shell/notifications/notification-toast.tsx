"use client";

import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "./notification-provider";
import type { NotificationItem } from "./notification-provider";

function Toast({
  notification,
  onDismiss,
}: {
  notification: NotificationItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background shadow-lg p-3 w-80 pointer-events-auto">
      <Bell className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        {notification.actionLabel && notification.actionPayload && (
          <a
            href={notification.actionPayload}
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            {notification.actionLabel}
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function NotificationToastStack() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} notification={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
