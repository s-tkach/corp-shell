import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { users, userRoles, roles, subscriptionTiers, tenantSubscription } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { UserManagerClient } from "./user-manager-client";

const PAGE_SIZE = 20;

export default async function UserManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "default";
  const tenantId = session?.user.tenantId ?? "";
  const tenantDb = withTenant(tenantSlug);

  const userRows = await tenantDb
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
    .limit(PAGE_SIZE)
    .offset(offset);

  const orgSubRow = await db
    .select({
      tierId: tenantSubscription.tierId,
      slug: subscriptionTiers.slug,
      displayName: subscriptionTiers.displayName,
      level: subscriptionTiers.level,
      expiresAt: tenantSubscription.expiresAt,
    })
    .from(tenantSubscription)
    .innerJoin(subscriptionTiers, eq(tenantSubscription.tierId, subscriptionTiers.id))
    .where(eq(tenantSubscription.tenantId, tenantId))
    .limit(1);
  const orgSubscription = orgSubRow[0] ?? null;

  const enriched = await Promise.all(
    userRows.map(async (u) => {
      const roleRows = await tenantDb
        .select({ slug: roles.slug, displayName: roles.displayName })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id))
        .orderBy(asc(roles.displayName));

      return { ...u, roles: roleRows, subscription: orgSubscription };
    })
  );

  const allRoles = await tenantDb
    .select({ id: roles.id, slug: roles.slug, displayName: roles.displayName })
    .from(roles)
    .orderBy(asc(roles.displayName));

  const allTiers = await db
    .select({ id: subscriptionTiers.id, slug: subscriptionTiers.slug, displayName: subscriptionTiers.displayName, level: subscriptionTiers.level })
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

  return (
    <UserManagerClient
      users={enriched}
      allRoles={allRoles}
      allTiers={allTiers}
      page={page}
      hasMore={userRows.length === PAGE_SIZE}
    />
  );
}
