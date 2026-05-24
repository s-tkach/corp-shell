import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { menuSections, menuItems } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { cacheTag } from "next/cache";

export interface MenuItem {
  id: string;
  label: string;
  route: string;
  icon: string | null;
  badge: string | null;
  sortOrder: number;
  isFolder: boolean;
  children: MenuItem[];
}

export interface MenuSection {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  items: MenuItem[];
}

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

async function buildMenuTree(
  roles: string[],
  subscriptionLevel: number
): Promise<MenuSection[]> {
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

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles: string[] = session.user.roles ?? [];
  const subscriptionLevel: number = session.user.subscriptionLevel ?? 0;

  const tree = await buildMenuTree(roles, subscriptionLevel);
  return NextResponse.json(tree);
}
