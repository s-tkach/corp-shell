import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { idpProviders } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";

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
    const discoveryUrl = `${body.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
    try {
      const res = await fetch(discoveryUrl, { next: { revalidate: 0 } });
      if (!res.ok) {
        return NextResponse.json(
          { error: `OIDC discovery failed: HTTP ${res.status}` },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: `OIDC discovery unreachable: ${e instanceof Error ? e.message : "Network error"}` },
        { status: 400 }
      );
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
  const tenantDb = withTenant(tenantSlug);

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
  const tenantDb = withTenant(tenantSlug);

  await tenantDb.delete(idpProviders).where(eq(idpProviders.id, providerId));

  return NextResponse.json({ ok: true });
}
