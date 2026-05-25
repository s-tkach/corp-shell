import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { menuSections } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { sectionId } = await params;
  const body = await req.json() as Partial<{ label: string; icon: string; sortOrder: number }>;
  const [row] = await tenantDb
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
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { sectionId } = await params;
  await tenantDb.delete(menuSections).where(eq(menuSections.id, sectionId));
  revalidateTag("menu", {});
  return new NextResponse(null, { status: 204 });
}
