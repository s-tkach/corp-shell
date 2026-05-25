import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { subscriptionTiers } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const rows = await tenantDb.select().from(subscriptionTiers).orderBy(asc(subscriptionTiers.level));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const body = await req.json() as {
    slug: string;
    displayName: string;
    level: number;
    upgradeCtaHeadline?: string;
    upgradeCtaBody?: string;
    upgradeCtaLabel?: string;
    upgradeUrl?: string;
  };
  const [row] = await tenantDb.insert(subscriptionTiers).values(body).returning();
  return NextResponse.json(row, { status: 201 });
}
