import { type NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { withTenant } from "@/lib/db/tenant";
import { provisionTenant } from "@/lib/db/provision";
import { tenants, shellConfig, idpProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantSlug } from "@/lib/tenant-resolver";

interface SetupPayload {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  backgroundColor: string;
  sidebarColor: string;
  accentColor: string;
  destructiveColor: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  superAdminEmail: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<SetupPayload>;

  const {
    appName, logoUrl, primaryColor,
    backgroundColor, sidebarColor, accentColor, destructiveColor,
    oidcIssuer, oidcClientId, oidcClientSecret, superAdminEmail,
  } = body;

  if (!appName?.trim() || !oidcIssuer?.trim() || !oidcClientId?.trim() || !oidcClientSecret?.trim() || !superAdminEmail?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(superAdminEmail)) {
    return NextResponse.json({ error: "Invalid super admin email" }, { status: 400 });
  }

  const tenantSlug = getTenantSlug(request.headers.get("host") ?? "") ?? "default";

  const tenantExists = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (tenantExists.length) {
    const tenantDb = withTenant(tenantSlug);
    const existing = await tenantDb.select().from(shellConfig).limit(1);
    if (existing[0]?.setupComplete) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 409 });
    }
  }

  const encryptedSecret = await encrypt(oidcClientSecret.trim());

  if (!tenantExists.length) {
    await provisionTenant(tenantSlug, appName.trim(), superAdminEmail.trim());
  }

  const tenantDb = withTenant(tenantSlug);

  await tenantDb
    .update(shellConfig)
    .set({
      appName: appName.trim(),
      logoUrl: logoUrl || null,
      colorOverrides: {
        "--primary": primaryColor || "#0f172a",
        "--background": backgroundColor || "#ffffff",
        "--sidebar-background": sidebarColor || "#f8fafc",
        "--accent": accentColor || "#f1f5f9",
        "--destructive": destructiveColor || "#ef4444",
      },
      setupComplete: true,
    });

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

  const response = NextResponse.json({ ok: true });
  response.cookies.set("shell_setup_complete", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
