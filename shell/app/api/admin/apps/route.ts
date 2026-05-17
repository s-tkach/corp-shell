import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { isSafeRemoteUrl } from "@/lib/url-guard";
import { asc } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const rows = await db.select().from(appRegistry).orderBy(asc(appRegistry.name));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const body = await req.json() as {
    name: string;
    remoteUrl: string;
    routePrefix: string;
    healthCheckUrl?: string;
  };
  if (!body.name || body.name.length > 100) {
    return NextResponse.json({ error: "name is required and must be ≤ 100 characters" }, { status: 400 });
  }
  if (!isSafeRemoteUrl(body.remoteUrl)) {
    return NextResponse.json({ error: "remoteUrl must be a valid HTTPS URL and not point to private networks" }, { status: 400 });
  }
  if (!body.routePrefix?.startsWith("/") || body.routePrefix.length > 200) {
    return NextResponse.json({ error: "routePrefix must start with / and be ≤ 200 characters" }, { status: 400 });
  }
  const [row] = await db
    .insert(appRegistry)
    .values({
      name: body.name,
      remoteUrl: body.remoteUrl,
      routePrefix: body.routePrefix,
      healthCheckUrl: body.healthCheckUrl ?? null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
