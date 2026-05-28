import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuItems, menuSections } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
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
  return NextResponse.json(rows.map((r) => r.menuItems));
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
  };
  if (!body.sectionId || !body.label) {
    return NextResponse.json({ error: "sectionId and label are required" }, { status: 400 });
  }
  const section = await db.select({ id: menuSections.id }).from(menuSections).where(eq(menuSections.id, body.sectionId)).limit(1);
  if (!section.length) {
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
  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
