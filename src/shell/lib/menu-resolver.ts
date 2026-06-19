export interface MenuTier {
  id: string;
  level: number;
}

export interface MenuSectionRecord {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
}

export interface MenuItemRecord {
  id: string;
  sectionId: string;
  parentItemId: string | null;
  isFolder: boolean;
  label: string;
  route: string;
  icon: string | null;
  badge: string | null;
  subscriptionTierId: string | null;
  sortOrder: number;
}

export interface ResolvedMenuItem {
  id: string;
  label: string;
  route: string;
  icon: string | null;
  badge: string | null;
  sortOrder: number;
  isFolder: boolean;
  children: ResolvedMenuItem[];
}

export interface ResolvedMenuSection {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  items: ResolvedMenuItem[];
}

interface BuildVisibleMenuTreeArgs {
  sections: MenuSectionRecord[];
  items: MenuItemRecord[];
  tiers: MenuTier[];
  subscriptionLevel: number;
  userRoles: string[];
  requiredRolesByItemId: Map<string, string[]>;
  isPlatformAdmin: boolean;
}

interface GetRequiredSubscriptionLevelForRouteArgs {
  items: MenuItemRecord[];
  tiers: MenuTier[];
  pathname: string;
}

interface GetRouteAccessForPathnameArgs {
  items: MenuItemRecord[];
  tiers: MenuTier[];
  pathname: string;
  subscriptionLevel: number;
  userRoles: string[];
  requiredRolesByItemId: Map<string, string[]>;
  isPlatformAdmin: boolean;
}

export type MenuRouteAccess = "allow" | "upgrade" | "forbidden" | "unmatched";

function getTierLevelById(tiers: MenuTier[]): Map<string, number> {
  return new Map(tiers.map((tier) => [tier.id, tier.level]));
}

function isItemVisible(
  item: MenuItemRecord,
  tierLevels: Map<string, number>,
  subscriptionLevel: number,
  userRoles: string[],
  requiredRolesByItemId: Map<string, string[]>,
  isPlatformAdmin: boolean
): boolean {
  if (item.subscriptionTierId === null) {
    return isPlatformAdmin;
  }

  const tierLevel = tierLevels.get(item.subscriptionTierId);
  if (tierLevel === undefined || tierLevel > subscriptionLevel) {
    return false;
  }

  const requiredRoles = requiredRolesByItemId.get(item.id) ?? [];
  if (requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some((role) => userRoles.includes(role));
}

export function buildVisibleMenuTree({
  sections,
  items,
  tiers,
  subscriptionLevel,
  userRoles,
  requiredRolesByItemId,
  isPlatformAdmin,
}: BuildVisibleMenuTreeArgs): ResolvedMenuSection[] {
  const tierLevels = getTierLevelById(tiers);

  return sections
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => {
      const sectionItems = items
        .filter((item) => item.sectionId === section.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const topLevelItems = sectionItems
        .filter((item) => item.parentItemId === null)
        .map<ResolvedMenuItem | null>((item) => {
          if (!isItemVisible(item, tierLevels, subscriptionLevel, userRoles, requiredRolesByItemId, isPlatformAdmin)) {
            return null;
          }

          const children = sectionItems
            .filter((child) => child.parentItemId === item.id)
            .filter((child) =>
              isItemVisible(child, tierLevels, subscriptionLevel, userRoles, requiredRolesByItemId, isPlatformAdmin)
            )
            .map<ResolvedMenuItem>((child) => ({
              id: child.id,
              label: child.label,
              route: child.route,
              icon: child.icon,
              badge: child.badge,
              sortOrder: child.sortOrder,
              isFolder: false,
              children: [],
            }));

          if (item.isFolder && children.length === 0) {
            return null;
          }

          return {
            id: item.id,
            label: item.label,
            route: item.route,
            icon: item.icon,
            badge: item.badge,
            sortOrder: item.sortOrder,
            isFolder: item.isFolder,
            children,
          };
        })
        .filter((item): item is ResolvedMenuItem => item !== null);

      return {
        id: section.id,
        label: section.label,
        icon: section.icon,
        sortOrder: section.sortOrder,
        items: topLevelItems,
      };
    })
    .filter((section) => section.items.length > 0);
}

export function getRequiredSubscriptionLevelForRoute({
  items,
  tiers,
  pathname,
}: GetRequiredSubscriptionLevelForRouteArgs): number | null {
  const tierLevels = getTierLevelById(tiers);
  const item = items.find((candidate) => candidate.route === pathname);

  if (!item || item.subscriptionTierId === null) {
    return null;
  }

  const requiredLevel = tierLevels.get(item.subscriptionTierId);
  if (requiredLevel === undefined || requiredLevel === 0) {
    return null;
  }

  return requiredLevel;
}

export function getRouteAccessForPathname({
  items,
  tiers,
  pathname,
  subscriptionLevel,
  userRoles,
  requiredRolesByItemId,
  isPlatformAdmin,
}: GetRouteAccessForPathnameArgs): MenuRouteAccess {
  const item = items.find((candidate) => candidate.route === pathname);
  if (!item) {
    return "unmatched";
  }

  if (item.subscriptionTierId === null) {
    if (!isPlatformAdmin) {
      return "forbidden";
    }
  } else {
    const tierLevels = getTierLevelById(tiers);
    const requiredLevel = tierLevels.get(item.subscriptionTierId);
    if (requiredLevel === undefined) {
      return "forbidden";
    }
    if (requiredLevel > subscriptionLevel) {
      return "upgrade";
    }
  }

  const requiredRoles = requiredRolesByItemId.get(item.id) ?? [];
  if (requiredRoles.length === 0) {
    return "allow";
  }

  return requiredRoles.some((role) => userRoles.includes(role))
    ? "allow"
    : "forbidden";
}
