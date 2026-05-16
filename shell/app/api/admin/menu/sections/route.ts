import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { menuSections } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export async function GET() {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const rows = await db.select().from(menuSections).orderBy(asc(menuSections.sortOrder));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const body = await req.json() as { label: string; icon?: string; sortOrder?: number };
  const [row] = await db
    .insert(menuSections)
    .values({ label: body.label, icon: body.icon ?? null, sortOrder: body.sortOrder ?? 0 })
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
