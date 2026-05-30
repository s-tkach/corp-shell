import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { rolePolicies } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const { roleId } = await params;
  const tenantDb = await getTenantDb();
  const rows = await tenantDb
    .select({ policySlug: rolePolicies.policySlug })
    .from(rolePolicies)
    .where(eq(rolePolicies.roleId, roleId));
  return NextResponse.json({ assignedSlugs: rows.map((r) => r.policySlug) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const { roleId } = await params;
  const body = await req.json() as { policySlugs: string[] };
  const tenantDb = await getTenantDb();
  await tenantDb.delete(rolePolicies).where(eq(rolePolicies.roleId, roleId));
  if (body.policySlugs.length > 0) {
    await tenantDb.insert(rolePolicies).values(
      body.policySlugs.map((slug) => ({ roleId, policySlug: slug }))
    );
  }
  return NextResponse.json({ assignedSlugs: body.policySlugs });
}
