import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { menuItems } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const { itemId } = await params;
  const body = await req.json() as Partial<{
    label: string;
    route: string;
    icon: string;
    badge: string;
    requiredRoles: string[];
    requiredSubLevel: number;
    sortOrder: number;
    sectionId: string;
    parentItemId: string | null;
    isFolder: boolean;
  }>;
  const [row] = await db
    .update(menuItems)
    .set(body)
    .where(eq(menuItems.id, itemId))
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const { itemId } = await params;
  await db.delete(menuItems).where(eq(menuItems.id, itemId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
