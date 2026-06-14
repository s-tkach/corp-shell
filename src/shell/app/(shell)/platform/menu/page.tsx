import { db } from "@/lib/db/client";
import { subscriptionTiers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { MenuManagerClient } from "./menu-manager-client";

export default async function PlatformMenuPage() {
  const allTiers = await db
    .select({
      id: subscriptionTiers.id,
      slug: subscriptionTiers.slug,
      displayName: subscriptionTiers.displayName,
      level: subscriptionTiers.level,
    })
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

  return <MenuManagerClient allTiers={allTiers} />;
}
