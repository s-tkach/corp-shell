import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { provisionTenant } from "@/lib/db/provision";
import { eq, asc } from "drizzle-orm";

const SLUG_RE = /^[a-z0-9-]+$/;

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

  const rows = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      displayName: tenants.displayName,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(asc(tenants.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardPlatformAdmin();
  if (guard) return guard;

  const body = await req.json() as { slug: string; displayName: string; adminEmail: string };
  const { slug, displayName, adminEmail } = body;

  if (!slug || !displayName || !adminEmail) {
    return NextResponse.json({ error: "slug, displayName, and adminEmail are required" }, { status: 400 });
  }

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "slug must match ^[a-z0-9-]+$" }, { status: 400 });
  }

  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 });
  }

  try {
    const { tenantId } = await provisionTenant(slug, displayName, adminEmail);
    return NextResponse.json({ tenantId, setupUrl: `https://${slug}.corp.example.com/setup` }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Provisioning failed" },
      { status: 500 }
    );
  }
}
