import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { menuItems } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const rows = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const body = await req.json() as {
    sectionId: string;
    label: string;
    route: string;
    icon?: string;
    badge?: string;
    requiredRoles?: string[];
    requiredSubLevel?: number;
    sortOrder?: number;
  };
  const [row] = await db
    .insert(menuItems)
    .values({
      sectionId: body.sectionId,
      label: body.label,
      route: body.route,
      icon: body.icon ?? null,
      badge: body.badge ?? null,
      requiredRoles: body.requiredRoles ?? [],
      requiredSubLevel: body.requiredSubLevel ?? 0,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();
  revalidateTag("menu", {});
  return NextResponse.json(row, { status: 201 });
}
