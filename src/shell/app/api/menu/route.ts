import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { menuSections, menuItems } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
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
  item: { requiredSubLevel: number },
  subscriptionLevel: number
): boolean {
  return item.requiredSubLevel <= subscriptionLevel;
}

async function buildMenuTree(
  tenantId: string,
  subscriptionLevel: number
): Promise<MenuSection[]> {
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

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId: string = session.user.tenantId ?? "";
  const subscriptionLevel: number = session.user.subscriptionLevel ?? 0;

  const tree = await buildMenuTree(tenantId, subscriptionLevel);
  return NextResponse.json(tree);
}
