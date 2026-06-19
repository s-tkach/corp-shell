import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRoles } from "@/lib/auth-guard";
import { db } from "@/lib/db/client";
import { menuItems, menuItemRoles, menuSections, roles, subscriptionTiers } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { and, asc, eq, inArray, isNull, not, or } from "drizzle-orm";
import { getRequestAccessSnapshot } from "@/lib/request-access";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const access = session
    ? await getRequestAccessSnapshot({
        tenantSlug,
        pathname: "",
        session,
      })
    : null;
  const subscriptionLevel = access?.subscriptionLevel ?? 0;
  const platformAdmin = isPlatformAdmin({
    roles: access?.userRoles ?? [],
    tenantSlug,
  });

  const tiers = await db
    .select({
      id: subscriptionTiers.id,
      slug: subscriptionTiers.slug,
      displayName: subscriptionTiers.displayName,
      level: subscriptionTiers.level,
    })
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

  const visibleTierIds = tiers
    .filter((tier) => tier.level <= subscriptionLevel)
    .map((tier) => tier.id);

  const sections = await db
    .select({
      id: menuSections.id,
      label: menuSections.label,
      icon: menuSections.icon,
      sortOrder: menuSections.sortOrder,
    })
    .from(menuSections)
    .orderBy(asc(menuSections.sortOrder));

  const items = await db
    .select({
      id: menuItems.id,
      sectionId: menuItems.sectionId,
      parentItemId: menuItems.parentItemId,
      isFolder: menuItems.isFolder,
      label: menuItems.label,
      route: menuItems.route,
      icon: menuItems.icon,
      badge: menuItems.badge,
      subscriptionTierId: menuItems.subscriptionTierId,
      sortOrder: menuItems.sortOrder,
    })
    .from(menuItems)
    .where(
      platformAdmin
        ? visibleTierIds.length === 0
          ? isNull(menuItems.subscriptionTierId)
          : or(inArray(menuItems.subscriptionTierId, visibleTierIds), isNull(menuItems.subscriptionTierId))
        : visibleTierIds.length === 0
          ? eq(menuItems.id, "")
          : and(not(isNull(menuItems.subscriptionTierId)), inArray(menuItems.subscriptionTierId, visibleTierIds))
    )
    .orderBy(asc(menuItems.sortOrder));

  const itemIds = items.map((item) => item.id);
  const tierLabels = new Map(tiers.map((tier) => [tier.id, tier.displayName]));

  let rolesByItemId = new Map<string, { id: string; slug: string; displayName: string }[]>();
  if (itemIds.length > 0) {
    const tenantDb = withTenant(tenantSlug);
    const assignments = await tenantDb
      .select({
        menuItemId: menuItemRoles.menuItemId,
        roleId: roles.id,
        slug: roles.slug,
        displayName: roles.displayName,
      })
      .from(menuItemRoles)
      .innerJoin(roles, eq(menuItemRoles.roleId, roles.id))
      .where(inArray(menuItemRoles.menuItemId, itemIds));

    rolesByItemId = assignments.reduce((map, assignment) => {
      const existing = map.get(assignment.menuItemId) ?? [];
      existing.push({
        id: assignment.roleId,
        slug: assignment.slug,
        displayName: assignment.displayName,
      });
      map.set(assignment.menuItemId, existing);
      return map;
    }, new Map<string, { id: string; slug: string; displayName: string }[]>());
  }

  return NextResponse.json({
    currentTier: {
      slug: access?.subscriptionTier ?? "free",
      level: subscriptionLevel,
    },
    sections,
    items: items.map((item) => {
      const assignedRoles = rolesByItemId.get(item.id) ?? [];
      return {
        ...item,
        subscriptionTierLabel: item.subscriptionTierId
          ? tierLabels.get(item.subscriptionTierId) ?? null
          : "Platform",
        requiredRoleIds: assignedRoles.map((role) => role.id),
        requiredRoles: assignedRoles.map((role) => role.slug),
        requiredRoleLabels: assignedRoles.map((role) => role.displayName),
      };
    }),
  });
}
