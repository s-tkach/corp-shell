import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications, notificationReads } from "@/lib/db/schema";

export function visibilityFilter(userId: string, subLevel: number) {
  const now = new Date();
  return and(
    or(isNull(notifications.expiresAt), gt(notifications.expiresAt, now)),
    or(
      eq(notifications.targetType, "all"),
      eq(notifications.targetUserId, userId),
      and(
        eq(notifications.targetType, "sub_level"),
        sql`${notifications.targetSubLevel} <= ${subLevel}`
      )
    )
  );
}

export async function getUnreadCount(userId: string, subLevel: number): Promise<number> {
  const visible = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(visibilityFilter(userId, subLevel));

  const readIds = (
    await db
      .select({ notificationId: notificationReads.notificationId })
      .from(notificationReads)
      .where(eq(notificationReads.userId, userId))
  ).map((r) => r.notificationId);

  return visible.filter((n) => !readIds.includes(n.id)).length;
}
