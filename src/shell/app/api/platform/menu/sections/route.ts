import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuSections } from "@/lib/db/schema";
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
  const rows = await db.select().from(menuSections).where(eq(menuSections.tenantId, tenantId)).orderBy(asc(menuSections.sortOrder));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const body = await req.json() as { tenantId: string; label: string; icon?: string; sortOrder?: number };
  if (!body.tenantId || !body.label) {
    return NextResponse.json({ error: "tenantId and label are required" }, { status: 400 });
  }
  const [row] = await db
    .insert(menuSections)
    .values({ tenantId: body.tenantId, label: body.label, icon: body.icon ?? null, sortOrder: body.sortOrder ?? 0 })
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
