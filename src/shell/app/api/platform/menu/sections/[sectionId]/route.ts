import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuSections } from "@/lib/db/schema";
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
  await db.delete(menuSections).where(eq(menuSections.id, sectionId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
