import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { subscriptionTiers } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { and, eq, ne } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { tierId } = await params;
  const body = await req.json() as Partial<{
    displayName: string;
    level: number;
    upgradeCtaHeadline: string;
    upgradeCtaBody: string;
    upgradeCtaLabel: string;
    upgradeUrl: string;
  }>;
  const [row] = await tenantDb
    .update(subscriptionTiers)
    .set(body)
    .where(eq(subscriptionTiers.id, tierId))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { tierId } = await params;
  const deleted = await tenantDb
    .delete(subscriptionTiers)
    .where(and(eq(subscriptionTiers.id, tierId), ne(subscriptionTiers.slug, "free")))
    .returning({ id: subscriptionTiers.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found or free tier cannot be deleted" }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
