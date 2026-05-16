import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { roles } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { and, eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requireRoles(["super_admin"]);
  } catch (r) {
    return r as Response;
  }
  const { roleId } = await params;
  const body = await req.json() as Partial<{ displayName: string }>;
  const [row] = await db
    .update(roles)
    .set(body)
    .where(and(eq(roles.id, roleId), eq(roles.isSystem, false)))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Not found or system role" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requireRoles(["super_admin"]);
  } catch (r) {
    return r as Response;
  }
  const { roleId } = await params;
  const deleted = await db
    .delete(roles)
    .where(and(eq(roles.id, roleId), eq(roles.isSystem, false)))
    .returning({ id: roles.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found or system role" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
