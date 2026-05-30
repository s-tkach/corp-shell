import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { roles, userRoles } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc, sql } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const rows = await tenantDb
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
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const body = await req.json() as { slug: string; displayName: string };
  const [row] = await tenantDb
    .insert(roles)
    .values({ slug: body.slug, displayName: body.displayName })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
