import Link from "next/link";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean; // unreadCount is pre-computed by parent; items display regardless of read state
}

interface NotificationsCardProps {
  notifications: NotificationItem[];
  unreadCount: number;
}

export function NotificationsCard({
  notifications,
  unreadCount,
}: NotificationsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </p>
        {unreadCount > 0 && (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            {unreadCount} new
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">You're all caught up.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((n) => (
            <li key={n.id} className="border-l-2 border-primary pl-3">
              <p className="text-sm font-medium leading-snug">{n.title}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {n.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {notifications.length > 0 && (
        <div className="mt-3 text-right">
          <Link
            href="/notifications"
            className="text-xs text-primary hover:underline"
          >
            View all &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
