import { getTenantDb } from "@/lib/db/tenant";
import { appRegistry } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { AppRegistryClient } from "./app-registry-client";

export default async function AppRegistryPage() {
  const tenantDb = await getTenantDb();
  const apps = await tenantDb.select().from(appRegistry).orderBy(asc(appRegistry.name));
  return <AppRegistryClient apps={apps} />;
}
