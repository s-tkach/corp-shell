import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuItemRoles, menuItems, menuSections, tenants } from "@/lib/db/schema";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { sectionId } = await params;
  const body = await req.json() as Partial<{ label: string; icon: string; sortOrder: number }>;
  const patch: Partial<{ label: string; icon: string; sortOrder: number }> = {};
  if (body.label !== undefined) patch.label = body.label;
  if (body.icon !== undefined) patch.icon = body.icon;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
  const [row] = await db
    .update(menuSections)
    .set(patch)
    .where(eq(menuSections.id, sectionId))
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { sectionId } = await params;

  const sectionItems = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.sectionId, sectionId));

  if (sectionItems.length > 0) {
    const tenantRows = await db.select({ slug: tenants.slug }).from(tenants);
    for (const tenant of tenantRows) {
      const tenantDb = withTenant(tenant.slug);
      for (const item of sectionItems) {
        await tenantDb.delete(menuItemRoles).where(eq(menuItemRoles.menuItemId, item.id));
      }
    }
  }

  await db.delete(menuSections).where(eq(menuSections.id, sectionId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
