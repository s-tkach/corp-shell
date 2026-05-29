import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { policies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { policyId } = await params;
  const body = await req.json() as Partial<{ displayName: string; description: string }>;
  const [row] = await db
    .update(policies)
    .set(body)
    .where(eq(policies.id, policyId))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { policyId } = await params;
  const deleted = await db
    .delete(policies)
    .where(eq(policies.id, policyId))
    .returning({ id: policies.id });
  if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
