import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { withTenant } from "@/lib/db/tenant";
import { tenants, shellConfig, subscriptionTiers, roles, users, userRoles, tenantSubscription, idpProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantSlug } from "@/lib/tenant-slug";

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

export async function POST(request: Request) {
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

  const tenantSlug = getTenantSlug();
  const tenantDb = withTenant(tenantSlug);

  // Guard: reject if already set up
  const existing = await tenantDb.select().from(shellConfig).limit(1);
  if (existing[0]?.setupComplete) {
    return NextResponse.json({ error: "Setup already complete" }, { status: 409 });
  }

  // Ensure tenant record exists in public schema for single-tenant mode
  const tenantExists = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenantExists.length) {
    await db.insert(tenants).values({
      slug: tenantSlug,
      displayName: appName.trim(),
      status: "active",
    });
  }

  const encryptedSecret = await encrypt(oidcClientSecret.trim());

  // Atomic write — Drizzle wraps this in a transaction
  await tenantDb.transaction(async (tx) => {
    // 1. shell_config
    await tx.insert(shellConfig).values({
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

    // 2. Default subscription tiers
    const [freeTier] = await tx
      .insert(subscriptionTiers)
      .values([
        { slug: "free", displayName: "Free", level: 0 },
        { slug: "standard", displayName: "Standard", level: 1 },
        { slug: "enterprise", displayName: "Enterprise", level: 2 },
      ])
      .returning();

    const enterpriseTier = await tx
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.slug, "enterprise"))
      .limit(1);

    // 3. Default roles
    const [superAdminRole] = await tx
      .insert(roles)
      .values([
        { slug: "super_admin", displayName: "Super Admin", isSystem: true },
        { slug: "admin", displayName: "Admin", isSystem: false },
      ])
      .returning();

    // 4. Super admin user
    const [superAdminUser] = await tx
      .insert(users)
      .values({
        email: superAdminEmail.trim().toLowerCase(),
        displayName: superAdminEmail.split("@")[0] ?? superAdminEmail,
        idpSource: "oidc",
        idpSubject: superAdminEmail.trim().toLowerCase(), // replaced with real sub on first login
      })
      .returning();

    if (!superAdminUser || !superAdminRole) {
      throw new Error("Failed to create super admin user or role");
    }

    // 5. user_roles: super_admin → super admin user
    await tx.insert(userRoles).values({
      userId: superAdminUser.id,
      roleId: superAdminRole.id,
    });

    // 6. tenant_subscription: enterprise tier, no expiry
    const entTier = enterpriseTier[0] ?? freeTier;
    if (!entTier) throw new Error("No enterprise tier found");

    await tx.insert(tenantSubscription).values({
      tierId: entTier.id,
      status: "active",
    });

    // 7. Store OIDC config in idpProviders
    await tx.insert(idpProviders).values({
      displayName: "Default OIDC",
      issuer: oidcIssuer.trim(),
      clientId: oidcClientId.trim(),
      encryptedClientSecret: encryptedSecret,
      scopes: ["openid", "profile", "email"],
      groupClaimName: "groups",
      isEnabled: true,
    });
  });

  // Set setup_complete cookie so proxy.ts stops redirecting to /setup
  const response = NextResponse.json({ ok: true });
  response.cookies.set("shell_setup_complete", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge — session cookie; persists for browser session
    // The proxy also reads DB in production M4+ flows
  });
  return response;
}

