import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuItems, menuSections, tenants } from "@/lib/db/schema";
import { menuItemRoles, roles } from "@/lib/db/tenant-schema";
import { withTenant } from "@/lib/db/tenant";
import { asc, eq, inArray } from "drizzle-orm";
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
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId is required" }, { status: 400 });

  const rows = await db
    .select({ menuItems })
    .from(menuItems)
    .innerJoin(menuSections, eq(menuItems.sectionId, menuSections.id))
    .where(eq(menuSections.tenantId, tenantId))
    .orderBy(asc(menuItems.sortOrder));

  const items = rows.map((r) => r.menuItems);

  const tenantRows = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const tenant = tenantRows[0];

  if (!tenant || items.length === 0) {
    return NextResponse.json(items.map((item) => ({ ...item, requiredRoles: [] })));
  }

  const itemIds = items.map((i) => i.id);
  const tenantDb = withTenant(tenant.slug);
  const assignments = await tenantDb
    .select({ menuItemId: menuItemRoles.menuItemId, slug: roles.slug })
    .from(menuItemRoles)
    .innerJoin(roles, eq(menuItemRoles.roleId, roles.id))
    .where(inArray(menuItemRoles.menuItemId, itemIds));

  const rolesByItem = new Map<string, string[]>();
  for (const a of assignments) {
    const existing = rolesByItem.get(a.menuItemId) ?? [];
    existing.push(a.slug);
    rolesByItem.set(a.menuItemId, existing);
  }

  return NextResponse.json(items.map((item) => ({ ...item, requiredRoles: rolesByItem.get(item.id) ?? [] })));
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
    requiredSubLevel?: number;
    sortOrder?: number;
    requiredRoleIds?: string[];
  };
  if (!body.sectionId || !body.label) {
    return NextResponse.json({ error: "sectionId and label are required" }, { status: 400 });
  }

  const sectionRows = await db
    .select({ id: menuSections.id, tenantId: menuSections.tenantId })
    .from(menuSections)
    .where(eq(menuSections.id, body.sectionId))
    .limit(1);
  const section = sectionRows[0];
  if (!section) {
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
      requiredSubLevel: body.requiredSubLevel ?? 0,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();

  if (body.requiredRoleIds?.length && row) {
    const tenantRows = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, section.tenantId))
      .limit(1);
    const tenant = tenantRows[0];
    if (tenant) {
      const tenantDb = withTenant(tenant.slug);
      await tenantDb.insert(menuItemRoles).values(
        body.requiredRoleIds.map((roleId) => ({ menuItemId: row.id, roleId }))
      );
    }
  }

  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
