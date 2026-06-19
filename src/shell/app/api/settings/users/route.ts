import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { users, subscriptionTiers, tenantSubscription } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { desc, eq } from "drizzle-orm";
import { getEffectiveRoleAssignmentsForUser } from "@/lib/role-assignments";

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
      const roleAssignments = await getEffectiveRoleAssignmentsForUser(tenantDb, u.id);

      return {
        ...u,
        manualRoles: roleAssignments.manualRoles,
        idpRoles: roleAssignments.idpRoles,
        effectiveRoles: roleAssignments.effectiveRoles,
        subscription: orgSubscription,
      };
    })
  );

  return NextResponse.json({ users: enriched, page, limit });
}
