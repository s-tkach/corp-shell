import { NextResponse } from "next/server";
import { withTenant } from "@/lib/db/tenant";
import { shellConfig, roles, users, userRoles, idpProviders } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { getPlatformSlug } from "@/lib/tenant-resolver";
import { eq } from "drizzle-orm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SetupBody {
  adminEmail: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  scopes?: string;
  tokenEndpointAuthMethod?: string;
}

export async function POST(request: Request) {
  const platformSlug = getPlatformSlug();
  const tenantDb = withTenant(platformSlug);

  // Guard: reject if already complete
  const configRows = await tenantDb
    .select({ setupComplete: shellConfig.setupComplete })
    .from(shellConfig)
    .limit(1);

  if (configRows[0]?.setupComplete) {
    return NextResponse.json({ error: "Setup already complete" }, { status: 409 });
  }

  const body = await request.json() as SetupBody;
  const { adminEmail, oidcIssuer, oidcClientId, oidcClientSecret } = body;
  const scopes = body.scopes?.trim() || "openid profile email";
  const tokenEndpointAuthMethod = body.tokenEndpointAuthMethod || "client_secret_post";

  if (!adminEmail || !oidcIssuer || !oidcClientId || !oidcClientSecret) {
    return NextResponse.json(
      { error: "adminEmail, oidcIssuer, oidcClientId, and oidcClientSecret are required" },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(adminEmail)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Fetch super_admin role
  const roleRows = await tenantDb
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, "super_admin"))
    .limit(1);

  const superAdminRole = roleRows[0];
  if (!superAdminRole) {
    return NextResponse.json(
      { error: "super_admin role not found — platform not bootstrapped" },
      { status: 500 }
    );
  }

  // Insert admin user
  const insertedUsers = await tenantDb
    .insert(users)
    .values({
      email: adminEmail,
      displayName: adminEmail.split("@")[0] ?? "admin",
      idpSource: "pending",
      idpSubject: "pending",
      isActive: true,
    })
    .returning({ id: users.id });

  const adminUser = insertedUsers[0];
  if (!adminUser) {
    return NextResponse.json({ error: "Failed to create admin user" }, { status: 500 });
  }

  // Assign super_admin role
  await tenantDb.insert(userRoles).values({
    userId: adminUser.id,
    roleId: superAdminRole.id,
  });

  // Insert IDP provider
  const encryptedSecret = await encrypt(oidcClientSecret.trim());
  await tenantDb.insert(idpProviders).values({
    slug: "oidc",
    displayName: "Platform SSO",
    issuer: oidcIssuer.trim(),
    clientId: oidcClientId.trim(),
    encryptedClientSecret: encryptedSecret,
    scopes: scopes.split(/\s+/).filter(Boolean),
    tokenEndpointAuthMethod,
    isEnabled: true,
  });

  // Mark setup complete
  await tenantDb.update(shellConfig).set({ setupComplete: true });

  return NextResponse.json({ ok: true });
}
