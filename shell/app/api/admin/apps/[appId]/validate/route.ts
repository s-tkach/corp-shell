import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

interface ChildAppManifest {
  name: string;
  version: string;
  routePrefix: string;
  routes: { path: string; label: string }[];
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const { appId } = await params;
  const rows = await db.select().from(appRegistry).where(eq(appRegistry.id, appId)).limit(1);
  const app = rows[0];
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const res = await fetch(`${app.remoteUrl}/mf-manifest.json`, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ valid: false, error: `HTTP ${res.status}` });
    }
    const manifest = await res.json() as ChildAppManifest;
    if (!manifest.name || !manifest.version || !manifest.routePrefix) {
      return NextResponse.json({ valid: false, error: "Invalid manifest shape" });
    }
    return NextResponse.json({ valid: true, manifest });
  } catch (e) {
    return NextResponse.json({ valid: false, error: e instanceof Error ? e.message : "Fetch failed" });
  }
}
