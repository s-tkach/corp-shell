import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { menuSections, menuItems, shellConfig, users } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { ShellLayoutClient } from "@/components/shell/shell-layout";
import { cacheTag } from "next/cache";
import type { MenuSection } from "@/app/api/menu/route";

async function getMenuTree(roles: string[], subscriptionLevel: number): Promise<MenuSection[]> {
  "use cache";
  cacheTag("menu");

  const sections = await db
    .select()
    .from(menuSections)
    .orderBy(asc(menuSections.sortOrder));

  const items = await db
    .select()
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder));

  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    sortOrder: section.sortOrder,
    items: items
      .filter((item) => {
        if (item.sectionId !== section.id) return false;
        if (item.requiredSubLevel > subscriptionLevel) return false;
        const required = item.requiredRoles as string[];
        if (required.length > 0 && !required.some((r) => roles.includes(r))) return false;
        return true;
      })
      .map((item) => ({
        id: item.id,
        label: item.label,
        route: item.route,
        icon: item.icon,
        badge: item.badge,
        sortOrder: item.sortOrder,
      })),
  }));
}

async function getShellConfig() {
  "use cache";
  cacheTag("shell-config");

  const rows = await db.select().from(shellConfig).limit(1);
  return rows[0] ?? null;
}

interface UserPreferences {
  sidebarCollapsed?: boolean;
  theme?: string;
}

async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const rows = await db
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

  const [menu, config, preferences] = await Promise.all([
    getMenuTree(roles, subscriptionLevel),
    getShellConfig(),
    userId ? getUserPreferences(userId) : Promise.resolve<UserPreferences>({}),
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
    >
      {children}
    </ShellLayoutClient>
  );
}
