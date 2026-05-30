import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db/tenant";
import { notifications, notificationReads } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { visibilityFilter } from "@/lib/notifications";
import { publishNotification } from "@/lib/sse-registry";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantDb = await getTenantDb();
  const userId = session.user.userId;
  const subLevel = session.user.subscriptionLevel ?? 0;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await tenantDb
    .select()
    .from(notifications)
    .where(visibilityFilter(userId, subLevel))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  const readRows = await tenantDb
    .select({ notificationId: notificationReads.notificationId })
    .from(notificationReads)
    .where(eq(notificationReads.userId, userId));

  const readSet = new Set(readRows.map((r) => r.notificationId));

  const result = rows.map((n) => ({ ...n, isRead: readSet.has(n.id) }));
  return NextResponse.json({ notifications: result, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantDb = await getTenantDb();
  const body = await req.json() as {
    title: string;
    body: string;
    actionLabel?: string;
    actionType?: string;
    actionPayload?: string;
    targetType?: string;
    targetUserId?: string;
    targetSubLevel?: number;
    expiresAt?: string;
  };

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const [created] = await tenantDb
    .insert(notifications)
    .values({
      title: body.title,
      body: body.body,
      actionLabel: body.actionLabel ?? null,
      actionType: body.actionType ?? null,
      actionPayload: body.actionPayload ?? null,
      targetType: body.targetType ?? "all",
      targetUserId: body.targetUserId ?? null,
      targetSubLevel: body.targetSubLevel ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdBy: session.user.userId,
    })
    .returning();

  if (!created) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  const tenantSlug = session.user.tenantSlug ?? "";
  await publishNotification(tenantSlug, JSON.stringify(created));

  return NextResponse.json({ id: created.id }, { status: 201 });
}
