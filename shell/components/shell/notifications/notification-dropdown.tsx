"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./notification-provider";
import type { NotificationItem } from "./notification-provider";

function NotificationRow({
  notification,
  onRead,
}: {
  notification: NotificationItem;
  onRead: () => void;
}) {
  return (
    <button
      onClick={onRead}
      className="w-full text-left flex items-start gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
    >
      <span
        className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
          notification.isRead ? "bg-transparent" : "bg-primary"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${notification.isRead ? "text-muted-foreground" : "font-medium"}`}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        {notification.actionLabel && notification.actionPayload && (
          <a
            href={notification.actionPayload}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline mt-0.5 inline-block"
          >
            {notification.actionLabel}
          </a>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

export function NotificationDropdownContent() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<"all" | "unread">("all");

  const visible = tab === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="w-80">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Notifications</span>
        <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

      <div className="flex border-b">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          visible.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onRead={() => !n.isRead && markRead(n.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
