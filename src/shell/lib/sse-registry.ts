import postgres from "postgres";
import { connectionString } from "@/lib/db/client";

export type NotificationPayload = {
  id: string;
  title: string;
  body: string;
  actionLabel: string | null;
  actionType: string | null;
  actionPayload: string | null;
  targetType: string;
  targetUserId: string | null;
  targetSubLevel: number | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
};

type Subscriber = {
  tenantSlug: string;
  userId: string;
  subLevel: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

// Per-process registry of active SSE subscribers keyed by connection ID
const subscribers = new Map<string, Subscriber>();

// Per-process Postgres LISTEN connection, keyed by tenant channel
const listenerConnections = new Map<string, postgres.Sql>();

function tenantChannel(tenantSlug: string): string {
  return `notifications_${tenantSlug}`;
}

export function registerSubscriber(
  id: string,
  tenantSlug: string,
  userId: string,
  subLevel: number,
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  subscribers.set(id, { tenantSlug, userId, subLevel, controller });
  ensureListener(tenantSlug);
}

export function removeSubscriber(id: string): void {
  subscribers.delete(id);
}

function ensureListener(tenantSlug: string): void {
  const channel = tenantChannel(tenantSlug);
  if (listenerConnections.has(channel)) return;

  const sql = postgres(connectionString!, { max: 1 });
  listenerConnections.set(channel, sql);

  sql.listen(channel, (rawPayload) => {
    let notification: NotificationPayload;
    try {
      notification = JSON.parse(rawPayload) as NotificationPayload;
    } catch {
      return;
    }
    fanOut(tenantSlug, notification);
  }).catch(() => {
    // Connection dropped; remove so next registerSubscriber recreates it
    listenerConnections.delete(channel);
    sql.end().catch(() => undefined);
  });
}

function fanOut(tenantSlug: string, notification: NotificationPayload): void {
  const encoder = new TextEncoder();
  const data = encoder.encode(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);

  for (const sub of subscribers.values()) {
    if (sub.tenantSlug !== tenantSlug) continue;
    if (!isEligible(sub, notification.targetType, notification.targetUserId, notification.targetSubLevel)) continue;
    try {
      sub.controller.enqueue(data);
    } catch {
      // subscriber disconnected; cleanup happens on stream cancel
    }
  }
}

export function isEligible(
  sub: { userId: string; subLevel: number },
  targetType: string,
  targetUserId: string | null,
  targetSubLevel: number | null
): boolean {
  if (targetType === "user") return sub.userId === targetUserId;
  if (targetType === "sub_level") return targetSubLevel !== null && sub.subLevel >= targetSubLevel;
  return true; // "all"
}

export async function publishNotification(tenantSlug: string, payload: string): Promise<void> {
  const channel = tenantChannel(tenantSlug);
  const sql = postgres(connectionString!, { max: 1 });
  try {
    await sql.notify(channel, payload);
  } finally {
    await sql.end();
  }
}
