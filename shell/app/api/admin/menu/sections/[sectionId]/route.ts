import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { menuSections } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const { sectionId } = await params;
  const body = await req.json() as Partial<{ label: string; icon: string; sortOrder: number }>;
  const [row] = await db
    .update(menuSections)
    .set(body)
    .where(eq(menuSections.id, sectionId))
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const { sectionId } = await params;
  await db.delete(menuSections).where(eq(menuSections.id, sectionId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
