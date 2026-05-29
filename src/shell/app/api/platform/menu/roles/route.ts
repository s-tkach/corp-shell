import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { withTenant } from "@/lib/db/tenant";
import { tenants } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { roles } from "@/lib/db/tenant-schema";
import { asc, eq } from "drizzle-orm";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId is required" }, { status: 400 });

  const tenantRows = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const tenant = tenantRows[0];
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const tenantDb = withTenant(tenant.slug);
  const rows = await tenantDb
    .select({ id: roles.id, slug: roles.slug, displayName: roles.displayName })
    .from(roles)
    .orderBy(asc(roles.displayName));

  return NextResponse.json(rows);
}
