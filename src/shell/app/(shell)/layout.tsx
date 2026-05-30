import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { menuSections, menuItems, shellConfig, users, companies, companyAncestors } from "@/lib/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { ShellLayoutClient } from "@/components/shell/shell-layout";
import { cacheTag } from "next/cache";
import type { MenuSection } from "@/app/api/menu/route";

function isVisible(
  item: { requiredSubLevel: number },
  subscriptionLevel: number
): boolean {
  return item.requiredSubLevel <= subscriptionLevel;
}

async function getMenuTree(tenantId: string, subscriptionLevel: number): Promise<MenuSection[]> {
  "use cache";
  cacheTag("menu");

  const sections = await db
    .select()
    .from(menuSections)
    .where(eq(menuSections.tenantId, tenantId))
    .orderBy(asc(menuSections.sortOrder));

  const allItems = await db
    .select()
    .from(menuItems)
    .innerJoin(menuSections, eq(menuItems.sectionId, menuSections.id))
    .where(eq(menuSections.tenantId, tenantId))
    .orderBy(asc(menuItems.sortOrder));

  const flatItems = allItems.map((r) => r.menu_items);

  return sections.map((section) => {
    const sectionItems = flatItems.filter((item) => item.sectionId === section.id);
    const topLevel = sectionItems.filter(
      (item) => item.parentItemId === null && isVisible(item, subscriptionLevel)
    );

    return {
      id: section.id,
      label: section.label,
      icon: section.icon,
      sortOrder: section.sortOrder,
      items: topLevel.map((item) => ({
        id: item.id,
        label: item.label,
        route: item.route,
        icon: item.icon,
        badge: item.badge,
        sortOrder: item.sortOrder,
        isFolder: item.isFolder,
        children: item.isFolder
          ? sectionItems
              .filter(
                (child) =>
                  child.parentItemId === item.id &&
                  isVisible(child, subscriptionLevel)
              )
              .map((child) => ({
                id: child.id,
                label: child.label,
                route: child.route,
                icon: child.icon,
                badge: child.badge,
                sortOrder: child.sortOrder,
                isFolder: false,
                children: [],
              }))
          : [],
      })),
    };
  });
}

async function getShellConfig(tenantSlug: string) {
  "use cache";
  cacheTag("shell-config");

  const tenantDb = withTenant(tenantSlug);
  const rows = await tenantDb.select().from(shellConfig).limit(1);
  return rows[0] ?? null;
}

interface UserPreferences {
  sidebarCollapsed?: boolean;
  theme?: string;
}

async function getUserPreferences(tenantSlug: string, userId: string): Promise<UserPreferences> {
  const tenantDb = withTenant(tenantSlug);
  const rows = await tenantDb
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (rows[0]?.preferences as UserPreferences | null) ?? {};
}

export default async function ShellGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const userId = session?.user.userId ?? "";
  const roles = session?.user.roles ?? [];
  const subscriptionLevel = session?.user.subscriptionLevel ?? 0;
  const userName = session?.user.name ?? "";
  const userEmail = session?.user.email ?? "";
  const tenantSlug = session?.user.tenantSlug ?? "";
  const tenantId = session?.user.tenantId ?? "";

  const [menu, config, preferences] = await Promise.all([
    getMenuTree(tenantId, subscriptionLevel),
    getShellConfig(tenantSlug),
    userId ? getUserPreferences(tenantSlug, userId) : Promise.resolve<UserPreferences>({}),
  ]);

  const userCompanyIds = session?.user.companyIds ?? [];
  let accessibleCompanies: { id: string; parentId: string | null; name: string; logoUrl: string | null; depth: number }[] = [];

  if (userCompanyIds.length > 0) {
    const layoutTenantDb = withTenant(session!.user.tenantSlug);

    const ancestorRows = await layoutTenantDb
      .select({ descendantId: companyAncestors.descendantId })
      .from(companyAncestors)
      .where(inArray(companyAncestors.ancestorId, userCompanyIds));

    const accessibleIds = [...new Set(ancestorRows.map((r) => r.descendantId))];

    if (accessibleIds.length > 0) {
      const companyRows = await layoutTenantDb
        .select({
          id: companies.id,
          parentId: companies.parentId,
          name: companies.name,
          logoUrl: companies.logoUrl,
          sortOrder: companies.sortOrder,
          isActive: companies.isActive,
        })
        .from(companies)
        .where(inArray(companies.id, accessibleIds));

      const accessibleIdSet = new Set(accessibleIds);

      function flattenTree(
        all: typeof companyRows,
        parentId: string | null,
        depth: number
      ): { id: string; parentId: string | null; name: string; logoUrl: string | null; depth: number }[] {
        return all
          .filter((c) => c.parentId === parentId && c.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .flatMap((c) => [
            { id: c.id, parentId: c.parentId, name: c.name, logoUrl: c.logoUrl, depth },
            ...flattenTree(all, c.id, depth + 1),
          ]);
      }

      // Start from nodes whose parent is not in the accessible set (topmost visible nodes).
      // This handles users assigned to non-root companies correctly.
      const roots = companyRows.filter((c) => c.parentId === null || !accessibleIdSet.has(c.parentId));
      accessibleCompanies = roots
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .flatMap((r) => [
          { id: r.id, parentId: r.parentId, name: r.name, logoUrl: r.logoUrl, depth: 0 },
          ...flattenTree(companyRows, r.id, 1),
        ])
        .filter((c) => c !== undefined);
    }
  }

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  return (
    <ShellLayoutClient
      menu={menu}
      appName={config?.appName ?? "Corp Shell"}
      logoUrl={config?.logoUrl ?? null}
      userName={userName}
      userEmail={userEmail}
      userRoles={roles}
      tenantSlug={tenantSlug}
      initialSidebarCollapsed={preferences.sidebarCollapsed ?? false}
      headerShowDate={config?.headerShowDate ?? false}
      headerDateFormat={config?.headerDateFormat ?? "PPP"}
      accessibleCompanies={accessibleCompanies}
      activeCompanyId={activeCompanyId}
      toastConfig={{
        position: config?.toastPosition ?? "bottom-right",
        bgColor: config?.toastBgColor ?? "#ffffff",
        textColor: config?.toastTextColor ?? "#020817",
        borderColor: config?.toastBorderColor ?? "#e2e8f0",
        duration: config?.toastDuration ?? 5000,
      }}
    >
      {children}
    </ShellLayoutClient>
  );
}
