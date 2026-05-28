import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
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
