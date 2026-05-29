import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuItems, menuSections, tenants } from "@/lib/db/schema";
import { menuItemRoles } from "@/lib/db/tenant-schema";
import { withTenant } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function getTenantSlugForItem(itemId: string): Promise<string | null> {
  const rows = await db
    .select({ slug: tenants.slug })
    .from(menuItems)
    .innerJoin(menuSections, eq(menuItems.sectionId, menuSections.id))
    .innerJoin(tenants, eq(menuSections.tenantId, tenants.id))
    .where(eq(menuItems.id, itemId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { itemId } = await params;
  const body = await req.json() as Partial<{
    label: string;
    route: string;
    icon: string;
    badge: string;
    requiredSubLevel: number;
    sortOrder: number;
    parentItemId: string | null;
    isFolder: boolean;
    requiredRoleIds: string[];
  }>;

  const patch: Partial<{
    label: string;
    route: string;
    icon: string;
    badge: string;
    requiredSubLevel: number;
    sortOrder: number;
    parentItemId: string | null;
    isFolder: boolean;
  }> = {};
  if (body.label !== undefined) patch.label = body.label;
  if (body.route !== undefined) patch.route = body.route;
  if (body.icon !== undefined) patch.icon = body.icon;
  if (body.badge !== undefined) patch.badge = body.badge;
  if (body.requiredSubLevel !== undefined) patch.requiredSubLevel = body.requiredSubLevel;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
  if (body.parentItemId !== undefined) patch.parentItemId = body.parentItemId;
  if (body.isFolder !== undefined) patch.isFolder = body.isFolder;

  const [row] = await db
    .update(menuItems)
    .set(patch)
    .where(eq(menuItems.id, itemId))
    .returning();

  if (body.requiredRoleIds !== undefined) {
    const tenantSlug = await getTenantSlugForItem(itemId);
    if (tenantSlug) {
      const tenantDb = withTenant(tenantSlug);
      await tenantDb.delete(menuItemRoles).where(eq(menuItemRoles.menuItemId, itemId));
      if (body.requiredRoleIds.length > 0) {
        await tenantDb.insert(menuItemRoles).values(
          body.requiredRoleIds.map((roleId) => ({ menuItemId: itemId, roleId }))
        );
      }
    }
  }

  revalidateTag("menu", {});
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { itemId } = await params;

  const tenantSlug = await getTenantSlugForItem(itemId);
  if (tenantSlug) {
    const tenantDb = withTenant(tenantSlug);
    await tenantDb.delete(menuItemRoles).where(eq(menuItemRoles.menuItemId, itemId));
  }

  await db.delete(menuItems).where(eq(menuItems.id, itemId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
