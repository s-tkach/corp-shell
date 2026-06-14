import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRoles } from "@/lib/auth-guard";
import { db } from "@/lib/db/client";
import { menuItems, menuItemRoles, roles, subscriptionTiers } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { eq, inArray } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const subscriptionLevel = session?.user.subscriptionLevel ?? 0;
  const platformAdmin = isPlatformAdmin({
    roles: session?.user.roles ?? [],
    tenantSlug,
  });

  const { itemId } = await params;
  const body = await req.json() as { requiredRoleIds: string[] };

  const tiers = await db
    .select({ id: subscriptionTiers.id, level: subscriptionTiers.level })
    .from(subscriptionTiers);
  const visibleTierIds = tiers
    .filter((tier) => tier.level <= subscriptionLevel)
    .map((tier) => tier.id);

  const rows = await db
    .select({
      id: menuItems.id,
      subscriptionTierId: menuItems.subscriptionTierId,
    })
    .from(menuItems)
    .where(eq(menuItems.id, itemId))
    .limit(1);
  const item = rows[0];
  if (!item) {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }

  const itemVisibleByTier =
    item.subscriptionTierId === null
      ? platformAdmin
      : visibleTierIds.includes(item.subscriptionTierId);
  if (!itemVisibleByTier) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantDb = withTenant(tenantSlug);
  await tenantDb.delete(menuItemRoles).where(eq(menuItemRoles.menuItemId, itemId));

  if (body.requiredRoleIds.length > 0) {
    const validRoles = await tenantDb
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.id, body.requiredRoleIds));

    await tenantDb.insert(menuItemRoles).values(
      validRoles.map((role) => ({
        menuItemId: itemId,
        roleId: role.id,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
