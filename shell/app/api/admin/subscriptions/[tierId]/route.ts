import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { subscriptionTiers } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { and, eq, ne } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {
  try {
    await requireRoles(["super_admin"]);
  } catch (r) {
    return r as Response;
  }
  const { tierId } = await params;
  const body = await req.json() as Partial<{
    displayName: string;
    level: number;
    upgradeCtaHeadline: string;
    upgradeCtaBody: string;
    upgradeCtaLabel: string;
    upgradeUrl: string;
  }>;
  const [row] = await db
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
  try {
    await requireRoles(["super_admin"]);
  } catch (r) {
    return r as Response;
  }
  const { tierId } = await params;
  const deleted = await db
    .delete(subscriptionTiers)
    .where(and(eq(subscriptionTiers.id, tierId), ne(subscriptionTiers.slug, "free")))
    .returning({ id: subscriptionTiers.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found or free tier cannot be deleted" }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
