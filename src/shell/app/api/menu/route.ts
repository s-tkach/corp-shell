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
}

export interface MenuSection {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  items: MenuItem[];
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
