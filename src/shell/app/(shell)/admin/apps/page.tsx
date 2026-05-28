import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { AppRegistryClient } from "./app-registry-client";

export default async function AppRegistryPage() {
  const apps = await db.select().from(appRegistry).orderBy(asc(appRegistry.name));
  return <AppRegistryClient apps={apps} />;
}
