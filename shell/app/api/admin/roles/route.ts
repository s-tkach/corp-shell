import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { roles, userRoles } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc, sql } from "drizzle-orm";

export async function GET() {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const rows = await db
    .select({
      id: roles.id,
      slug: roles.slug,
      displayName: roles.displayName,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
      userCount: sql<number>`(select count(*) from ${userRoles} where ${userRoles.roleId} = ${roles.id})`.mapWith(Number),
    })
    .from(roles)
    .orderBy(asc(roles.displayName));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    await requireRoles(["super_admin"]);
  } catch (r) {
    return r as Response;
  }
  const body = await req.json() as { slug: string; displayName: string };
  const [row] = await db
    .insert(roles)
    .values({ slug: body.slug, displayName: body.displayName })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
