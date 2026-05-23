import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, userRoles, roles, userSubscriptions, subscriptionTiers } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc, desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await db
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

  const enriched = await Promise.all(
    rows.map(async (u) => {
      const roleRows = await db
        .select({ slug: roles.slug, displayName: roles.displayName })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id))
        .orderBy(asc(roles.displayName));

      const subRow = await db
        .select({ slug: subscriptionTiers.slug, displayName: subscriptionTiers.displayName, level: subscriptionTiers.level, expiresAt: userSubscriptions.expiresAt })
        .from(userSubscriptions)
        .innerJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
        .where(eq(userSubscriptions.userId, u.id))
        .limit(1);

      return { ...u, roles: roleRows, subscription: subRow[0] ?? null };
    })
  );

  return NextResponse.json({ users: enriched, page, limit });
}
