import { db } from "@/lib/db/client";
import { menuSections, menuItems, roles, subscriptionTiers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { MenuManagerClient } from "./menu-manager-client";

export default async function MenuManagerPage() {
  const [sections, items, allRoles, allTiers] = await Promise.all([
    db.select().from(menuSections).orderBy(asc(menuSections.sortOrder)),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder)),
    db.select({ slug: roles.slug, displayName: roles.displayName }).from(roles).orderBy(asc(roles.displayName)),
    db.select({ id: subscriptionTiers.id, slug: subscriptionTiers.slug, displayName: subscriptionTiers.displayName, level: subscriptionTiers.level }).from(subscriptionTiers).orderBy(asc(subscriptionTiers.level)),
  ]);

  return <MenuManagerClient sections={sections} items={items} allRoles={allRoles} allTiers={allTiers} />;
}
