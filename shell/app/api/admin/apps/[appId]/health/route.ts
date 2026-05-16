import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const { appId } = await params;
  const rows = await db.select().from(appRegistry).where(eq(appRegistry.id, appId)).limit(1);
  const app = rows[0];
  if (!app?.healthCheckUrl) {
    return NextResponse.json({ healthy: false, error: "No healthCheckUrl configured" });
  }

  try {
    const res = await fetch(app.healthCheckUrl, { next: { revalidate: 0 } });
    const healthy = res.ok;
    if (healthy) {
      await db
        .update(appRegistry)
        .set({ lastHealthyAt: new Date() })
        .where(eq(appRegistry.id, appId));
    }
    return NextResponse.json({ healthy, status: res.status });
  } catch (e) {
    return NextResponse.json({ healthy: false, error: e instanceof Error ? e.message : "Fetch failed" });
  }
}
