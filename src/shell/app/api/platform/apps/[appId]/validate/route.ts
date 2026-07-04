import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { fetchRemoteManifest } from "@/lib/remote-target-guard";
import { eq } from "drizzle-orm";

interface ChildAppManifest {
  name: string;
  version: string;
  routePrefix: string;
  routes: { path: string; label: string }[];
}

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const { appId } = await params;
  const rows = await db.select().from(appRegistry).where(eq(appRegistry.id, appId)).limit(1);
  const app = rows[0];
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manifestResult = await fetchRemoteManifest(app.remoteUrl);
  if (!manifestResult.ok) {
    return NextResponse.json({ valid: false, error: manifestResult.error });
  }

  const manifest = manifestResult.data as Partial<ChildAppManifest>;
  if (!manifest.name || !manifest.version || !manifest.routePrefix) {
    return NextResponse.json({ valid: false, error: "Manifest is invalid" });
  }

  return NextResponse.json({ valid: true, manifest });
}
