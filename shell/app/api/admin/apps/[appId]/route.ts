import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const { appId } = await params;
  const body = await req.json() as Partial<{
    name: string;
    remoteUrl: string;
    routePrefix: string;
    healthCheckUrl: string;
    isEnabled: boolean;
  }>;
  const [row] = await db
    .update(appRegistry)
    .set(body)
    .where(eq(appRegistry.id, appId))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const { appId } = await params;
  await db.delete(appRegistry).where(eq(appRegistry.id, appId));
  return new NextResponse(null, { status: 204 });
}
