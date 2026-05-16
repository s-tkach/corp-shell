import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { subscriptionTiers } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const rows = await db.select().from(subscriptionTiers).orderBy(asc(subscriptionTiers.level));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    await requireRoles(["super_admin"]);
  } catch (r) {
    return r as Response;
  }
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
