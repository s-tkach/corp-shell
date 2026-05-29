import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { policies } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

async function guardPlatformAdmin() {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function guardAdminOrAbove() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userRoles: string[] = session.user.roles ?? [];
  const hasAccess =
    isPlatformAdmin({ roles: userRoles, tenantSlug: session.user.tenantSlug ?? "" }) ||
    userRoles.includes("super_admin") ||
    userRoles.includes("admin");
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const guard = await guardAdminOrAbove();
  if (guard) return guard;
  const rows = await db.select().from(policies).orderBy(asc(policies.slug));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;
  const body = await req.json() as { slug: string; displayName: string; description?: string };
  const [row] = await db.insert(policies).values({
    slug: body.slug,
    displayName: body.displayName,
    description: body.description ?? null,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
