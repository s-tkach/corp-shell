import { db } from "@/lib/db/client";
import { users, userRoles, roles, userSubscriptions, subscriptionTiers } from "@/lib/db/schema";
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

  const userRows = await db
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

  const enriched = await Promise.all(
    userRows.map(async (u) => {
      const roleRows = await db
        .select({ slug: roles.slug, displayName: roles.displayName })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id))
        .orderBy(asc(roles.displayName));

      const subRow = await db
        .select({
          tierId: userSubscriptions.tierId,
          slug: subscriptionTiers.slug,
          displayName: subscriptionTiers.displayName,
          level: subscriptionTiers.level,
          expiresAt: userSubscriptions.expiresAt,
        })
        .from(userSubscriptions)
        .innerJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
        .where(eq(userSubscriptions.userId, u.id))
        .limit(1);

      return { ...u, roles: roleRows, subscription: subRow[0] ?? null };
    })
  );

  const allRoles = await db
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
