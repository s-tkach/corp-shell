import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { idpProviders } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { asc } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const tenantDb = withTenant(tenantSlug);

  const rows = await tenantDb
    .select({
      id: idpProviders.id,
      displayName: idpProviders.displayName,
      issuer: idpProviders.issuer,
      clientId: idpProviders.clientId,
      scopes: idpProviders.scopes,
      groupClaimName: idpProviders.groupClaimName,
      isEnabled: idpProviders.isEnabled,
      createdAt: idpProviders.createdAt,
    })
    .from(idpProviders)
    .orderBy(asc(idpProviders.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const body = await req.json() as {
    slug?: string;
    displayName?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
    groupClaimName?: string;
  };

  const { slug, displayName, issuer, clientId, clientSecret, scopes, groupClaimName } = body;
  if (!slug || !displayName || !issuer || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "slug, displayName, issuer, clientId, clientSecret are required" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 }
    );
  }

  const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  try {
    const res = await fetch(discoveryUrl, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `OIDC discovery failed: HTTP ${res.status} from ${discoveryUrl}` },
        { status: 400 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: `OIDC discovery unreachable: ${e instanceof Error ? e.message : "Network error"}` },
      { status: 400 }
    );
  }

  const encryptedClientSecret = await encrypt(clientSecret);

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const tenantDb = withTenant(tenantSlug);

  const inserted = await tenantDb
    .insert(idpProviders)
    .values({
      slug,
      displayName,
      issuer,
      clientId,
      encryptedClientSecret,
      scopes: scopes ?? ["openid", "email", "profile"],
      groupClaimName: groupClaimName ?? "groups",
      isEnabled: true,
    })
    .returning({ id: idpProviders.id });

  return NextResponse.json({ id: inserted[0]?.id }, { status: 201 });
}
