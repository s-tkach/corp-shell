import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { companies } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { createCompany } from "@/lib/actions/companies";
import { asc } from "drizzle-orm";

export async function GET() {
  const rolesErr = await requireRoles(["super_admin", "admin"]);
  if (rolesErr) return rolesErr;

  const session = await auth();
  const db = withTenant(session!.user.tenantSlug);
  const rows = await db
    .select()
    .from(companies)
    .orderBy(asc(companies.sortOrder), asc(companies.name));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const rolesErr = await requireRoles(["super_admin", "admin"]);
  if (rolesErr) return rolesErr;

  const body = (await req.json()) as {
    name: string;
    parentId: string | null;
    logoUrl?: string | null;
    sortOrder?: number;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const company = await createCompany(body);
  return NextResponse.json(company, { status: 201 });
}
