import { db } from "@/lib/db/client";
import { subscriptionTiers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { SubscriptionTiersClient } from "./subscription-tiers-client";

export default async function SubscriptionTiersPage() {
  const tiers = await db.select().from(subscriptionTiers).orderBy(asc(subscriptionTiers.level));
  return <SubscriptionTiersClient tiers={tiers} />;
}
