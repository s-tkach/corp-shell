import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { idpGroupRoleMappings } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mappingId: string }> }
) {
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const tenantDb = await getTenantDb();
  const { mappingId } = await params;
  await tenantDb.delete(idpGroupRoleMappings).where(eq(idpGroupRoleMappings.id, mappingId));
  return new NextResponse(null, { status: 204 });
}
