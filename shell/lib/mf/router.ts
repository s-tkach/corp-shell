import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";

export interface RegisteredApp {
  id: string;
  name: string;
  remoteUrl: string;
  routePrefix: string;
  healthCheckUrl: string | null;
  isEnabled: boolean;
}

export async function fetchRegisteredApps(): Promise<RegisteredApp[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db
    .select({
      id: appRegistry.id,
      name: appRegistry.name,
      remoteUrl: appRegistry.remoteUrl,
      routePrefix: appRegistry.routePrefix,
      healthCheckUrl: appRegistry.healthCheckUrl,
      isEnabled: appRegistry.isEnabled,
    })
    .from(appRegistry)
    .where(eq(appRegistry.isEnabled, true));

  return rows;
}

export function resolveAppForPath(
  pathname: string,
  apps: RegisteredApp[]
): RegisteredApp | null {
  let match: RegisteredApp | null = null;
  let matchLength = 0;

  for (const app of apps) {
    const prefix = app.routePrefix.endsWith("/")
      ? app.routePrefix.slice(0, -1)
      : app.routePrefix;

    if (
      pathname === prefix ||
      pathname.startsWith(prefix + "/")
    ) {
      if (prefix.length > matchLength) {
        match = app;
        matchLength = prefix.length;
      }
    }
  }

  return match;
}
