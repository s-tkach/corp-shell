import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuItems, menuSections, subscriptionTiers } from "@/lib/db/schema";
import { and, asc, eq, inArray, isNull, not } from "drizzle-orm";
import { revalidateTag } from "next/cache";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const selectedTierId = req.nextUrl.searchParams.get("tierId");
  const scope = req.nextUrl.searchParams.get("scope");

  const tiers = await db
    .select({
      id: subscriptionTiers.id,
      slug: subscriptionTiers.slug,
      displayName: subscriptionTiers.displayName,
      level: subscriptionTiers.level,
    })
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

  if (scope === "platform") {
    const rows = await db
      .select()
      .from(menuItems)
      .where(isNull(menuItems.subscriptionTierId))
      .orderBy(asc(menuItems.sortOrder));

    return NextResponse.json(
      rows.map((item) => ({
        ...item,
        subscriptionTierLabel: null,
        isInherited: false,
      }))
    );
  }

  if (!selectedTierId) {
    return NextResponse.json({ error: "tierId or scope=platform is required" }, { status: 400 });
  }

  const selectedTier = tiers.find((tier) => tier.id === selectedTierId);
  if (!selectedTier) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const visibleTierIds = tiers
    .filter((tier) => tier.level <= selectedTier.level)
    .map((tier) => tier.id);

  const rows = await db
    .select()
    .from(menuItems)
    .where(
      and(
        not(isNull(menuItems.subscriptionTierId)),
        inArray(menuItems.subscriptionTierId, visibleTierIds)
      )
    )
    .orderBy(asc(menuItems.sortOrder));

  const tierLabels = new Map(tiers.map((tier) => [tier.id, tier.displayName]));
  return NextResponse.json(
    rows.map((item) => ({
      ...item,
      subscriptionTierLabel: item.subscriptionTierId
        ? tierLabels.get(item.subscriptionTierId) ?? null
        : null,
      isInherited: item.subscriptionTierId !== selectedTierId,
    }))
  );
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const body = await req.json() as {
    sectionId: string;
    parentItemId?: string;
    isFolder?: boolean;
    label: string;
    route?: string;
    icon?: string;
    badge?: string;
    subscriptionTierId?: string | null;
    sortOrder?: number;
  };

  if (!body.sectionId || !body.label) {
    return NextResponse.json({ error: "sectionId and label are required" }, { status: 400 });
  }

  const sectionRows = await db
    .select({ id: menuSections.id })
    .from(menuSections)
    .where(eq(menuSections.id, body.sectionId))
    .limit(1);
  if (!sectionRows[0]) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const [row] = await db
    .insert(menuItems)
    .values({
      sectionId: body.sectionId,
      parentItemId: body.parentItemId ?? null,
      isFolder: body.isFolder ?? false,
      label: body.label,
      route: body.route ?? "",
      icon: body.icon ?? null,
      badge: body.badge ?? null,
      subscriptionTierId: body.subscriptionTierId ?? null,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();

  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
