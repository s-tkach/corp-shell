import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { users, userRoles, roles, subscriptionTiers, tenantSubscription } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc, desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "default";
  const tenantId = session?.user.tenantId ?? "";
  const tenantDb = withTenant(tenantSlug);

  const rows = await tenantDb
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const orgSubRow = await db
    .select({ slug: subscriptionTiers.slug, displayName: subscriptionTiers.displayName, level: subscriptionTiers.level, expiresAt: tenantSubscription.expiresAt })
    .from(tenantSubscription)
    .innerJoin(subscriptionTiers, eq(tenantSubscription.tierId, subscriptionTiers.id))
    .where(eq(tenantSubscription.tenantId, tenantId))
    .limit(1);
  const orgSubscription = orgSubRow[0] ?? null;

  const enriched = await Promise.all(
    rows.map(async (u) => {
      const roleRows = await tenantDb
        .select({ slug: roles.slug, displayName: roles.displayName })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id))
        .orderBy(asc(roles.displayName));

      return { ...u, roles: roleRows, subscription: orgSubscription };
    })
  );

  return NextResponse.json({ users: enriched, page, limit });
}
