import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { menuSections } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { revalidateTag } from "next/cache";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const rows = await db.select().from(menuSections).orderBy(asc(menuSections.sortOrder));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const body = await req.json() as { label: string; icon?: string; sortOrder?: number };
  if (!body.label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  const [row] = await db
    .insert(menuSections)
    .values({ label: body.label, icon: body.icon ?? null, sortOrder: body.sortOrder ?? 0 })
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
