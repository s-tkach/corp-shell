import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuItems } from "@/lib/db/schema";
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
  }>;
  const patch: typeof body = {};
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
  await db.delete(menuItems).where(eq(menuItems.id, itemId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
