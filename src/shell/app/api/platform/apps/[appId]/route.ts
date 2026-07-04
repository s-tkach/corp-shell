import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { getPublicHttpsFieldError, validateRemoteUrl } from "@/lib/remote-target-guard";
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
  { params }: { params: Promise<{ appId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { appId } = await params;
  const body = await req.json() as Partial<{
    name: string;
    remoteUrl: string;
    routePrefix: string;
    healthCheckUrl: string;
    isEnabled: boolean;
  }>;
  if (body.remoteUrl !== undefined && !validateRemoteUrl(body.remoteUrl).ok) {
    return NextResponse.json({ error: getPublicHttpsFieldError("remoteUrl") }, { status: 400 });
  }
  if (body.healthCheckUrl !== undefined && !validateRemoteUrl(body.healthCheckUrl).ok) {
    return NextResponse.json({ error: getPublicHttpsFieldError("healthCheckUrl") }, { status: 400 });
  }
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
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { appId } = await params;
  await db.delete(appRegistry).where(eq(appRegistry.id, appId));
  return new NextResponse(null, { status: 204 });
}
