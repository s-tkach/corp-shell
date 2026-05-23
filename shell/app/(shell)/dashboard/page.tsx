import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { notifications, notificationReads, menuSections, menuItems } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { visibilityFilter } from "@/lib/notifications";
import { cacheTag } from "next/cache";
import type { MenuItem, MenuSection } from "@/app/api/menu/route";
import { GreetingBanner } from "./_components/greeting-banner";
import { AppsGrid } from "./_components/apps-grid";
import { ProfileCard } from "./_components/profile-card";
import { NotificationsCard } from "./_components/notifications-card";

async function getMenuItems(roles: string[], subscriptionLevel: number): Promise<MenuItem[]> {
  "use cache";
  cacheTag("menu");

  const sections = await db
    .select()
    .from(menuSections)
    .orderBy(asc(menuSections.sortOrder));

  const items = await db
    .select()
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder));

  const tree: MenuSection[] = sections.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    sortOrder: section.sortOrder,
    items: items
      .filter((item) => {
        if (item.sectionId !== section.id) return false;
        if (item.requiredSubLevel > subscriptionLevel) return false;
        const required = item.requiredRoles as string[];
        if (required.length > 0 && !required.some((r) => roles.includes(r))) return false;
        return true;
      })
      .map((item) => ({
        id: item.id,
        label: item.label,
        route: item.route,
        icon: item.icon,
        badge: item.badge,
        sortOrder: item.sortOrder,
      })),
  }));

  return tree.flatMap((s) => s.items);
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
}

async function getRecentNotifications(
  userId: string,
  subLevel: number
): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const rows = await db
    .select()
    .from(notifications)
    .where(visibilityFilter(userId, subLevel))
    .orderBy(desc(notifications.createdAt))
    .limit(5);

  const readRows = await db
    .select({ notificationId: notificationReads.notificationId })
    .from(notificationReads)
    .where(eq(notificationReads.userId, userId));

  const readSet = new Set(readRows.map((r) => r.notificationId));
  const items = rows.map((n) => ({ id: n.id, title: n.title, body: n.body, isRead: readSet.has(n.id) }));
  const unreadCount = items.filter((n) => !n.isRead).length;

  return { notifications: items, unreadCount };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");

  const userId = session.user.userId;
  const roles = session.user.roles ?? [];
  const subscriptionLevel = session.user.subscriptionLevel ?? 0;

  const [appMenuItems, { notifications: recentNotifications, unreadCount }] = await Promise.all([
    getMenuItems(roles, subscriptionLevel),
    getRecentNotifications(userId, subscriptionLevel),
  ]);

  const name = session.user.name ?? session.user.email ?? "there";
  const email = session.user.email ?? "";
  const subscriptionTier = session.user.subscriptionTier ?? "free";
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <GreetingBanner name={name} date={now} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        {/* Left: apps */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Apps
          </p>
          <AppsGrid items={appMenuItems} />
        </div>

        {/* Right: profile + notifications */}
        <div className="flex flex-col gap-4">
          <ProfileCard
            name={name}
            email={email}
            roles={roles}
            subscriptionTier={subscriptionTier}
          />
          <NotificationsCard
            notifications={recentNotifications}
            unreadCount={unreadCount}
          />
        </div>
      </div>
    </div>
  );
}
