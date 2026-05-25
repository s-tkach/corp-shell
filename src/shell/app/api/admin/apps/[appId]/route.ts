import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { appRegistry } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { isSafeRemoteUrl } from "@/lib/url-guard";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { appId } = await params;
  const body = await req.json() as Partial<{
    name: string;
    remoteUrl: string;
    routePrefix: string;
    healthCheckUrl: string;
    isEnabled: boolean;
  }>;
  if (body.remoteUrl !== undefined && !isSafeRemoteUrl(body.remoteUrl)) {
    return NextResponse.json({ error: "remoteUrl must be a valid HTTPS URL and not point to private networks" }, { status: 400 });
  }
  const [row] = await tenantDb
    .update(appRegistry)
    .set(body)
    .where(eq(appRegistry.id, appId))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { appId } = await params;
  await tenantDb.delete(appRegistry).where(eq(appRegistry.id, appId));
  return new NextResponse(null, { status: 204 });
}
