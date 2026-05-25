import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { menuSections } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const rows = await tenantDb.select().from(menuSections).orderBy(asc(menuSections.sortOrder));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const body = await req.json() as { label: string; icon?: string; sortOrder?: number };
  const [row] = await tenantDb
    .insert(menuSections)
    .values({ label: body.label, icon: body.icon ?? null, sortOrder: body.sortOrder ?? 0 })
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
