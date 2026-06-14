import { and, asc, eq, inArray, isNull, not, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { menuItems, menuSections, menuItemRoles, roles, subscriptionTiers } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import {
  buildVisibleMenuTree,
  getRequiredSubscriptionLevelForRoute as resolveRequiredSubscriptionLevelForRoute,
  type MenuItemRecord,
  type MenuSectionRecord,
  type MenuTier,
  type ResolvedMenuItem,
  type ResolvedMenuSection,
} from "@/lib/menu-resolver";

export type MenuItem = ResolvedMenuItem;
export type MenuSection = ResolvedMenuSection;

async function getSharedMenuData(subscriptionLevel: number) {
  const tiers = await db
    .select({ id: subscriptionTiers.id, level: subscriptionTiers.level })
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

  const maxVisibleTier = tiers
    .filter((tier) => tier.level <= subscriptionLevel)
    .at(-1);

  const sections = await db
    .select({
      id: menuSections.id,
      label: menuSections.label,
      icon: menuSections.icon,
      sortOrder: menuSections.sortOrder,
    })
    .from(menuSections)
    .orderBy(asc(menuSections.sortOrder));

  const visibleTierIds = tiers
    .filter((tier) => tier.level <= subscriptionLevel)
    .map((tier) => tier.id);

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
      visibleTierIds.length === 0
        ? isNull(menuItems.subscriptionTierId)
        : or(
            inArray(menuItems.subscriptionTierId, visibleTierIds),
            isNull(menuItems.subscriptionTierId)
          )
    )
    .orderBy(asc(menuItems.sortOrder));

  return {
    tiers: tiers as MenuTier[],
    sections: sections as MenuSectionRecord[],
    items: items as MenuItemRecord[],
    maxVisibleTierLevel: maxVisibleTier?.level ?? 0,
  };
}

async function getRequiredRolesByItemId(tenantSlug: string, itemIds: string[]): Promise<Map<string, string[]>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const tenantDb = withTenant(tenantSlug);
  const assignments = await tenantDb
    .select({ menuItemId: menuItemRoles.menuItemId, slug: roles.slug })
    .from(menuItemRoles)
    .innerJoin(roles, eq(menuItemRoles.roleId, roles.id))
    .where(inArray(menuItemRoles.menuItemId, itemIds));

  const requiredRolesByItemId = new Map<string, string[]>();
  for (const assignment of assignments) {
    const existing = requiredRolesByItemId.get(assignment.menuItemId) ?? [];
    existing.push(assignment.slug);
    requiredRolesByItemId.set(assignment.menuItemId, existing);
  }

  return requiredRolesByItemId;
}

export async function getMenuTreeForTenant({
  tenantSlug,
  subscriptionLevel,
  userRoles,
  isPlatformAdmin,
}: {
  tenantSlug: string;
  subscriptionLevel: number;
  userRoles: string[];
  isPlatformAdmin: boolean;
}): Promise<MenuSection[]> {
  const { tiers, sections, items } = await getSharedMenuData(subscriptionLevel);
  const requiredRolesByItemId = await getRequiredRolesByItemId(
    tenantSlug,
    items.map((item) => item.id)
  );

  return buildVisibleMenuTree({
    sections,
    items,
    tiers,
    subscriptionLevel,
    userRoles,
    requiredRolesByItemId,
    isPlatformAdmin,
  });
}

export async function getVisibleMenuItemsForTenant({
  tenantSlug,
  subscriptionLevel,
  userRoles,
  isPlatformAdmin,
}: {
  tenantSlug: string;
  subscriptionLevel: number;
  userRoles: string[];
  isPlatformAdmin: boolean;
}): Promise<MenuItem[]> {
  const tree = await getMenuTreeForTenant({
    tenantSlug,
    subscriptionLevel,
    userRoles,
    isPlatformAdmin,
  });

  return tree.flatMap((section) => section.items);
}

export async function getRequiredSubscriptionLevelForRoute(pathname: string): Promise<number | null> {
  const tiers = await db
    .select({ id: subscriptionTiers.id, level: subscriptionTiers.level })
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

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
    .where(and(eq(menuItems.route, pathname), not(isNull(menuItems.subscriptionTierId))))
    .limit(1);

  return resolveRequiredSubscriptionLevelForRoute({
    items: items as MenuItemRecord[],
    tiers: tiers as MenuTier[],
    pathname,
  });
}
