import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tenantSubscription, subscriptionTiers } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const session = await auth();
  const tenantId = session?.user.tenantId ?? "";

  const rows = await db
    .select({
      tierId: tenantSubscription.tierId,
      status: tenantSubscription.status,
      expiresAt: tenantSubscription.expiresAt,
      assignedAt: tenantSubscription.assignedAt,
      tierSlug: subscriptionTiers.slug,
      tierDisplayName: subscriptionTiers.displayName,
      tierLevel: subscriptionTiers.level,
      upgradeCtaHeadline: subscriptionTiers.upgradeCtaHeadline,
      upgradeCtaBody: subscriptionTiers.upgradeCtaBody,
      upgradeCtaLabel: subscriptionTiers.upgradeCtaLabel,
      upgradeUrl: subscriptionTiers.upgradeUrl,
    })
    .from(tenantSubscription)
    .innerJoin(subscriptionTiers, eq(tenantSubscription.tierId, subscriptionTiers.id))
    .where(eq(tenantSubscription.tenantId, tenantId))
    .limit(1);

  return NextResponse.json(rows[0] ?? null);
}
