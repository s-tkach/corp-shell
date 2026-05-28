import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { subscriptionTiers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const rows = await db.select().from(subscriptionTiers).orderBy(asc(subscriptionTiers.level));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const body = await req.json() as {
    slug: string;
    displayName: string;
    level: number;
    upgradeCtaHeadline?: string;
    upgradeCtaBody?: string;
    upgradeCtaLabel?: string;
    upgradeUrl?: string;
  };
  const [row] = await db.insert(subscriptionTiers).values(body).returning();
  return NextResponse.json(row, { status: 201 });
}
