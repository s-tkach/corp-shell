import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withTenant } from "@/lib/db/tenant";
import { notifications, notificationReads } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { visibilityFilter } from "@/lib/notifications";
import { getVisibleMenuItemsForTenant } from "@/lib/menu";
import { getRequestAccessSnapshot } from "@/lib/request-access";
import { GreetingBanner } from "./_components/greeting-banner";
import { AppsGrid } from "./_components/apps-grid";
import { ProfileCard } from "./_components/profile-card";
import { NotificationsCard } from "./_components/notifications-card";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
}

async function getRecentNotifications(
  tenantSlug: string,
  userId: string,
  subLevel: number
): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const tenantDb = withTenant(tenantSlug);
  const rows = await tenantDb
    .select()
    .from(notifications)
    .where(visibilityFilter(userId, subLevel))
    .orderBy(desc(notifications.createdAt))
    .limit(5);

  const readRows = await tenantDb
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
  const tenantSlug = session.user.tenantSlug ?? "";
  const access = await getRequestAccessSnapshot({
    tenantSlug,
    pathname: "",
    session,
  });
  const roles = access.userRoles;
  const subscriptionLevel = access.subscriptionLevel;
  const platformAdmin = access.isPlatformAdmin;

  const [appMenuItems, { notifications: recentNotifications, unreadCount }] = await Promise.all([
    getVisibleMenuItemsForTenant({
      tenantSlug,
      subscriptionLevel,
      userRoles: roles,
      isPlatformAdmin: platformAdmin,
    }),
    getRecentNotifications(tenantSlug, userId, subscriptionLevel),
  ]);

  const name = session.user.name ?? session.user.email ?? "there";
  const email = session.user.email ?? "";
  const subscriptionTier = access.subscriptionTier;
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
