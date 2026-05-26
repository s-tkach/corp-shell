import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { connectionString as _connectionString } from "./client";

const connectionString = _connectionString!;

const tenantPools = new Map<string, ReturnType<typeof drizzle>>();

export function withTenant(slug: string) {
  const cached = tenantPools.get(slug);
  if (cached) return cached;

  const client = postgres(connectionString, {
    max: 1,
    connection: { search_path: `tenant_${slug},public` },
  });
  const db = drizzle(client, { schema });
  tenantPools.set(slug, db);
  return db;
}

export async function getTenantDb() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const slug = session?.user.tenantSlug;
  if (!slug) throw new Error("No tenant context");
  return withTenant(slug);
}
