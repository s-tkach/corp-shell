import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { connectionString as _connectionString } from "./client";

const connectionString = _connectionString!;

const MAX_CACHED_TENANTS = 32;

// LRU cache: insertion order tracks recency; oldest entry evicted when full
const tenantPools = new Map<string, { db: ReturnType<typeof drizzle>; client: postgres.Sql }>();

export function withTenant(slug: string) {
  const cached = tenantPools.get(slug);
  if (cached) {
    // Refresh recency: delete and re-insert moves to end of insertion order
    tenantPools.delete(slug);
    tenantPools.set(slug, cached);
    return cached.db;
  }

  if (tenantPools.size >= MAX_CACHED_TENANTS) {
    const oldestKey = tenantPools.keys().next().value;
    if (oldestKey !== undefined) {
      const oldest = tenantPools.get(oldestKey);
      tenantPools.delete(oldestKey);
      oldest?.client.end().catch(() => undefined);
    }
  }

  const client = postgres(connectionString, {
    max: 1,
    connection: { search_path: `tenant_${slug},public` },
  });
  const db = drizzle(client, { schema });
  tenantPools.set(slug, { db, client });
  return db;
}

export async function getTenantDb() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const slug = session?.user.tenantSlug;
  if (!slug) throw new Error("No tenant context");
  return withTenant(slug);
}

// Exposed only for tests — clears all cached connections without ending them
// (mocked clients have no real connection to close)
export function __clearTenantCache(): void {
  tenantPools.clear();
}
