import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { companyAncestors } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = (await req.json()) as { companyId: string | null };

  if (companyId !== null) {
    const db = withTenant(session.user.tenantSlug);
    const userCompanyIds = session.user.companyIds;

    const hasAccess = userCompanyIds.length > 0
      ? await db
          .select({ id: companyAncestors.descendantId })
          .from(companyAncestors)
          .where(
            and(
              eq(companyAncestors.descendantId, companyId),
              inArray(companyAncestors.ancestorId, userCompanyIds)
            )
          )
          .limit(1)
      : [];

    if (hasAccess.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const response = NextResponse.json({ ok: true });
  if (companyId) {
    response.cookies.set("active_company_id", companyId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    response.cookies.delete("active_company_id");
  }
  return response;
}
