import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { idpProviders, tenants } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { fetchOidcDiscovery, getPublicHttpsFieldError, isRemoteUrlValidationFailure } from "@/lib/remote-target-guard";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const { providerId } = await params;
  const body = await req.json() as {
    displayName?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
    groupClaimName?: string;
    isEnabled?: boolean;
  };

  if (body.issuer) {
    const discovery = await fetchOidcDiscovery(body.issuer);
    if (!discovery.ok) {
      const error = isRemoteUrlValidationFailure(discovery.kind)
        ? getPublicHttpsFieldError("issuer")
        : discovery.error;
      return NextResponse.json({ error }, { status: 400 });
    }
  }

  const updateValues: Partial<typeof idpProviders.$inferInsert> = {};
  if (body.displayName !== undefined) updateValues.displayName = body.displayName;
  if (body.issuer !== undefined) updateValues.issuer = body.issuer;
  if (body.clientId !== undefined) updateValues.clientId = body.clientId;
  if (body.clientSecret !== undefined) updateValues.encryptedClientSecret = await encrypt(body.clientSecret);
  if (body.scopes !== undefined) updateValues.scopes = body.scopes;
  if (body.groupClaimName !== undefined) updateValues.groupClaimName = body.groupClaimName;
  if (body.isEnabled !== undefined) updateValues.isEnabled = body.isEnabled;

  if (Object.keys(updateValues).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const tenantId = session?.user.tenantId ?? "";
  const tenantDb = withTenant(tenantSlug);

  if (body.isEnabled === false) {
    const tenantRow = await db.select({ isPlatform: tenants.isPlatform }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (tenantRow[0]?.isPlatform) {
      const rows = await tenantDb.select({ count: sql<number>`count(*)::int` }).from(idpProviders).where(eq(idpProviders.isEnabled, true));
      if ((rows[0]?.count ?? 0) <= 1) {
        return NextResponse.json({ error: "Cannot disable the last SSO provider on a platform tenant" }, { status: 409 });
      }
    }
  }

  await tenantDb
    .update(idpProviders)
    .set(updateValues)
    .where(eq(idpProviders.id, providerId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const { providerId } = await params;
  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const tenantId = session?.user.tenantId ?? "";
  const tenantDb = withTenant(tenantSlug);

  const tenantRow = await db.select({ isPlatform: tenants.isPlatform }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (tenantRow[0]?.isPlatform) {
    const rows = await tenantDb.select({ count: sql<number>`count(*)::int` }).from(idpProviders);
    if ((rows[0]?.count ?? 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last SSO provider on a platform tenant" }, { status: 409 });
    }
  }

  await tenantDb.delete(idpProviders).where(eq(idpProviders.id, providerId));

  return NextResponse.json({ ok: true });
}
