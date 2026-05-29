import { db } from "@/lib/db/client";
import { policies } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { PoliciesClient } from "./policies-client";

export default async function PoliciesPage() {
  const rows = await db.select().from(policies).orderBy(asc(policies.slug));
  return <PoliciesClient policies={rows} />;
}
