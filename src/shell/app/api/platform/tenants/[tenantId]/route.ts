import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { tenants, subscriptionTiers, tenantSubscription } from "@/lib/db/schema";
import { getPlatformSlug } from "@/lib/tenant-resolver";
import { eq } from "drizzle-orm";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const { tenantId } = await params;
  const body = await req.json() as {
    status?: "active" | "suspended" | "deleted";
    tierId?: string;
  };

  if (!body.status && !body.tierId) {
    return NextResponse.json({ error: "status or tierId is required" }, { status: 400 });
  }

  if (body.status && !["active", "suspended", "deleted"].includes(body.status)) {
    return NextResponse.json({ error: "status must be active, suspended, or deleted" }, { status: 400 });
  }

  const existing = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (existing[0].slug === getPlatformSlug()) {
    return NextResponse.json({ error: "Cannot modify the platform tenant" }, { status: 400 });
  }

  if (body.tierId) {
    const tier = await db
      .select({ id: subscriptionTiers.id })
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.id, body.tierId))
      .limit(1);

    if (!tier[0]) {
      return NextResponse.json({ error: `Unknown tier "${body.tierId}"` }, { status: 400 });
    }

    await db
      .update(tenantSubscription)
      .set({ tierId: body.tierId })
      .where(eq(tenantSubscription.tenantId, tenantId));
  }

  if (body.status) {
    await db
      .update(tenants)
      .set({ status: body.status })
      .where(eq(tenants.id, tenantId));
  }

  return NextResponse.json({ ok: true });
}
