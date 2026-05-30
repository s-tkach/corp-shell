import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { companies } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { CompaniesClient } from "./companies-client";

export default async function CompaniesPage() {
  const session = await auth();
  const db = withTenant(session!.user.tenantSlug);

  const rows = await db
    .select()
    .from(companies)
    .orderBy(asc(companies.sortOrder), asc(companies.name));

  return <CompaniesClient companies={rows} />;
}
