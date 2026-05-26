import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { tenants, idpProviders, shellConfig } from "@/lib/db/schema";
import { provisionTenant } from "@/lib/db/provision";
import { withTenant } from "@/lib/db/tenant";
import { encrypt } from "@/lib/crypto";
import { eq, asc } from "drizzle-orm";

const SLUG_RE = /^[a-z0-9-]+$/;

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const rows = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      displayName: tenants.displayName,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(asc(tenants.createdAt));

  return NextResponse.json(rows);
}

interface CreateTenantBody {
  slug: string;
  displayName: string;
  adminEmail: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  appName?: string;
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const body = await req.json() as CreateTenantBody;
  const { slug, displayName, adminEmail, oidcIssuer, oidcClientId, oidcClientSecret, appName } = body;

  if (!slug || !displayName || !adminEmail || !oidcIssuer || !oidcClientId || !oidcClientSecret) {
    return NextResponse.json({ error: "slug, displayName, adminEmail, oidcIssuer, oidcClientId, and oidcClientSecret are required" }, { status: 400 });
  }

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "slug must match ^[a-z0-9-]+$" }, { status: 400 });
  }

  if (slug === "platform") {
    return NextResponse.json({ error: "Cannot create tenant with slug 'platform'" }, { status: 400 });
  }

  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 });
  }

  try {
    const { tenantId } = await provisionTenant(slug, displayName, adminEmail);

    const tenantDb = withTenant(slug);
    const encryptedSecret = await encrypt(oidcClientSecret.trim());

    await tenantDb.insert(idpProviders).values({
      slug: "oidc",
      displayName: "Default OIDC",
      issuer: oidcIssuer.trim(),
      clientId: oidcClientId.trim(),
      encryptedClientSecret: encryptedSecret,
      scopes: ["openid", "profile", "email"],
      groupClaimName: "groups",
      isEnabled: true,
    });

    if (appName?.trim()) {
      await tenantDb.update(shellConfig).set({ appName: appName.trim() });
    }

    return NextResponse.json({ tenantId }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Provisioning failed" },
      { status: 500 }
    );
  }
}
