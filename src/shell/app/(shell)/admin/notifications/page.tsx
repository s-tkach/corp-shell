import { getTenantDb } from "@/lib/db/tenant";
import { notifications, notificationReads } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { NotificationsAdminClient } from "./notifications-client";

export default async function AdminNotificationsPage() {
  const tenantDb = await getTenantDb();
  const rows = await tenantDb
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const enriched = await Promise.all(
    rows.map(async (n) => {
      const result = await tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationReads)
        .where(eq(notificationReads.notificationId, n.id));
      return { ...n, readCount: result[0]?.count ?? 0 };
    })
  );

  return <NotificationsAdminClient initialNotifications={enriched} />;
}
