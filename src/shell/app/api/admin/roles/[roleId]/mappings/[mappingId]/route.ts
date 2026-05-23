import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { idpGroupRoleMappings } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mappingId: string }> }
) {
  const authError = await requireRoles(["super_admin"]);
  if (authError) return authError;
  const { mappingId } = await params;
  await db.delete(idpGroupRoleMappings).where(eq(idpGroupRoleMappings.id, mappingId));
  return new NextResponse(null, { status: 204 });
}
