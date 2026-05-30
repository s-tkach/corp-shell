import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { userCompanies } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { setUserCompanies } from "@/lib/actions/companies";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rolesErr = await requireRoles(["super_admin", "admin"]);
  if (rolesErr) return rolesErr;

  const { userId } = await params;
  const session = await auth();
  const db = withTenant(session!.user.tenantSlug);

  const rows = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, userId));

  return NextResponse.json(rows.map((r) => r.companyId));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rolesErr = await requireRoles(["super_admin", "admin"]);
  if (rolesErr) return rolesErr;

  const { userId } = await params;
  const body = (await req.json()) as { companyIds: string[] };

  if (!Array.isArray(body.companyIds)) {
    return NextResponse.json({ error: "companyIds must be an array" }, { status: 400 });
  }

  await setUserCompanies(userId, body.companyIds);
  return NextResponse.json({ ok: true });
}
