import { db } from "@/lib/db/client";
import { tenants, subscriptionTiers } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { MenuManagerClient } from "./menu-manager-client";

export default async function PlatformMenuPage() {
  const [allTenants, allTiers] = await Promise.all([
    db.select({ id: tenants.id, slug: tenants.slug, displayName: tenants.displayName })
      .from(tenants)
      .where(eq(tenants.status, "active"))
      .orderBy(asc(tenants.displayName)),
    db.select({ id: subscriptionTiers.id, slug: subscriptionTiers.slug, displayName: subscriptionTiers.displayName, level: subscriptionTiers.level })
      .from(subscriptionTiers)
      .orderBy(asc(subscriptionTiers.level)),
  ]);

  return <MenuManagerClient tenants={allTenants} allTiers={allTiers} />;
}
