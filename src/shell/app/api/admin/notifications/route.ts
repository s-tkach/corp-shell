import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { notifications, notificationReads } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { desc, sql } from "drizzle-orm";
import { pushToEligible } from "@/lib/sse-registry";

export async function GET(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await tenantDb
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      actionLabel: notifications.actionLabel,
      actionType: notifications.actionType,
      actionPayload: notifications.actionPayload,
      targetType: notifications.targetType,
      targetUserId: notifications.targetUserId,
      targetSubLevel: notifications.targetSubLevel,
      expiresAt: notifications.expiresAt,
      createdBy: notifications.createdBy,
      createdAt: notifications.createdAt,
      readCount: sql<number>`count(${notificationReads.notificationId})::int`,
    })
    .from(notifications)
    .leftJoin(notificationReads, sql`${notificationReads.notificationId} = ${notifications.id}`)
    .groupBy(notifications.id)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ notifications: rows, page, limit });
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  pushToEligible(
    JSON.stringify(created),
    created.targetType,
    created.targetUserId ?? null,
    created.targetSubLevel ?? null
  );

  return NextResponse.json({ id: created.id }, { status: 201 });
}
