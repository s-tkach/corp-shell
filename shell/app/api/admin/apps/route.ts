import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appRegistry } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const rows = await db.select().from(appRegistry).orderBy(asc(appRegistry.name));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const body = await req.json() as {
    name: string;
    remoteUrl: string;
    routePrefix: string;
    healthCheckUrl?: string;
  };
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
