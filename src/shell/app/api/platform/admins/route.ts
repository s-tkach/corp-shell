import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { withTenant } from "@/lib/db/tenant";
import { getPlatformSlug } from "@/lib/tenant-resolver";
import { users, roles, userRoles } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

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

  const tenantDb = withTenant(getPlatformSlug());

  const superAdminRole = await tenantDb
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, "super_admin"))
    .limit(1);

  if (!superAdminRole[0]) {
    return NextResponse.json([]);
  }

  const adminUserIds = await tenantDb
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, superAdminRole[0].id));

  if (adminUserIds.length === 0) {
    return NextResponse.json([]);
  }

  const admins = await tenantDb
    .select({ id: users.id, email: users.email, displayName: users.displayName, createdAt: users.createdAt })
    .from(users)
    .where(inArray(users.id, adminUserIds.map((r) => r.userId)));

  return NextResponse.json(admins);
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const body = await req.json() as { email: string };
  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const tenantDb = withTenant(getPlatformSlug());

  const existing = await tenantDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const superAdminRole = await tenantDb
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, "super_admin"))
    .limit(1);

  if (!superAdminRole[0]) {
    return NextResponse.json({ error: "super_admin role not found" }, { status: 500 });
  }

  if (existing[0]) {
    // User exists — ensure they have super_admin role
    const hasRole = await tenantDb
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.userId, existing[0].id))
      .limit(1);

    if (hasRole.length === 0) {
      await tenantDb.insert(userRoles).values({
        userId: existing[0].id,
        roleId: superAdminRole[0].id,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Pre-create user with pending IDP — will be linked on first OIDC login
  const inserted = await tenantDb
    .insert(users)
    .values({
      email,
      displayName: email.split("@")[0] ?? "admin",
      idpSource: "pending",
      idpSubject: "pending",
      isActive: true,
    })
    .returning({ id: users.id });

  const newUser = inserted[0];
  if (!newUser) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }

  await tenantDb.insert(userRoles).values({
    userId: newUser.id,
    roleId: superAdminRole[0].id,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
