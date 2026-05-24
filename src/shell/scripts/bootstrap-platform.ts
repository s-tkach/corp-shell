#!/usr/bin/env tsx
import { provisionTenant } from "../lib/db/provision";
import { db } from "../lib/db/client";
import { tenants } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const platformEmail = process.env["PLATFORM_ADMIN_EMAIL"];
  if (!platformEmail) {
    console.error("Set PLATFORM_ADMIN_EMAIL env var");
    process.exit(1);
  }

  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, "platform"))
    .limit(1);

  if (existing[0]) {
    console.log("tenant_platform schema already exists — skipping");
    process.exit(0);
  }

  console.log(`Provisioning tenant_platform for ${platformEmail}...`);
  const { tenantId } = await provisionTenant("platform", "Platform Admin", platformEmail);
  console.log(`Done. tenantId=${tenantId}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
