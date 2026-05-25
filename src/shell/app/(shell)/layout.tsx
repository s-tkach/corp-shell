import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { menuSections, menuItems, shellConfig, users } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { ShellLayoutClient } from "@/components/shell/shell-layout";
import { cacheTag } from "next/cache";
import type { MenuSection } from "@/app/api/menu/route";

function isVisible(
  item: { requiredSubLevel: number; requiredRoles: unknown },
  roles: string[],
  subscriptionLevel: number
): boolean {
  if (item.requiredSubLevel > subscriptionLevel) return false;
  const required = item.requiredRoles as string[];
  if (required.length > 0 && !required.some((r) => roles.includes(r))) return false;
  return true;
}

async function getMenuTree(tenantSlug: string, roles: string[], subscriptionLevel: number): Promise<MenuSection[]> {
  "use cache";
  cacheTag("menu");

  const tenantDb = withTenant(tenantSlug);
  const sections = await tenantDb
    .select()
    .from(menuSections)
    .orderBy(asc(menuSections.sortOrder));

  const items = await tenantDb
    .select()
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder));

  return sections.map((section) => {
    const sectionItems = items.filter((item) => item.sectionId === section.id);
    const topLevel = sectionItems.filter(
      (item) => item.parentItemId === null && isVisible(item, roles, subscriptionLevel)
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
                  isVisible(child, roles, subscriptionLevel)
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

  const [menu, config, preferences] = await Promise.all([
    getMenuTree(tenantSlug, roles, subscriptionLevel),
    getShellConfig(tenantSlug),
    userId ? getUserPreferences(tenantSlug, userId) : Promise.resolve<UserPreferences>({}),
  ]);

  return (
    <ShellLayoutClient
      menu={menu}
      appName={config?.appName ?? "Corp Shell"}
      logoUrl={config?.logoUrl ?? null}
      userName={userName}
      userEmail={userEmail}
      userRoles={roles}
      initialSidebarCollapsed={preferences.sidebarCollapsed ?? false}
      headerShowDate={config?.headerShowDate ?? false}
      headerDateFormat={config?.headerDateFormat ?? "PPP"}
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
