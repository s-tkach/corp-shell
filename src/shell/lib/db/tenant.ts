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
