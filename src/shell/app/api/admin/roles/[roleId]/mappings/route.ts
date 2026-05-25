import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { idpGroupRoleMappings } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { roleId } = await params;
  const rows = await tenantDb
    .select()
    .from(idpGroupRoleMappings)
    .where(eq(idpGroupRoleMappings.roleId, roleId));
  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { roleId } = await params;
  const body = await req.json() as { idpGroupName: string };
  const [row] = await tenantDb
    .insert(idpGroupRoleMappings)
    .values({ roleId, idpGroupName: body.idpGroupName })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
