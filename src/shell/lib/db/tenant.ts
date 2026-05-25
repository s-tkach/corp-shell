import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { connectionString as _connectionString } from "./client";

const connectionString = _connectionString!;

export function withTenant(slug: string) {
  const client = postgres(connectionString, {
    max: 1,
    connection: { search_path: `tenant_${slug},public` },
  });
  return drizzle(client, { schema });
}

export async function getTenantDb() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const slug = session?.user.tenantSlug;
  if (!slug) throw new Error("No tenant context");
  return withTenant(slug);
}
