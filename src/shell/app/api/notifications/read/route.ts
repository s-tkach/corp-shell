import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db/tenant";
import { notifications, notificationReads } from "@/lib/db/schema";
import { getUnreadCount, visibilityFilter } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantDb = await getTenantDb();
  const userId = session.user.userId;
  const subLevel = session.user.subscriptionLevel ?? 0;
  const { notificationId } = await req.json() as { notificationId: string | "all" };

  if (notificationId === "all") {
    const visible = await tenantDb
      .select({ id: notifications.id })
      .from(notifications)
      .where(visibilityFilter(userId, subLevel));

    if (visible.length > 0) {
      await tenantDb
        .insert(notificationReads)
        .values(visible.map((n) => ({ notificationId: n.id, userId })))
        .onConflictDoNothing();
    }
  } else {
    await tenantDb
      .insert(notificationReads)
      .values({ notificationId, userId })
      .onConflictDoNothing();
  }

  const unreadCount = await getUnreadCount(userId, subLevel);
  return NextResponse.json({ unreadCount });
}
