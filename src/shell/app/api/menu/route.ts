import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMenuTreeForTenant } from "@/lib/menu";
import { getRequestAccessSnapshot, mapRequestAccessOutcomeToDecision } from "@/lib/request-access";

export type { MenuItem, MenuSection } from "@/lib/menu";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantSlug: string = session.user.tenantSlug ?? "";
  const access = await getRequestAccessSnapshot({
    tenantSlug,
    pathname: "/api/menu",
    session,
  });
  const decision = mapRequestAccessOutcomeToDecision({
    outcome: access.outcome,
    pathname: "/api/menu",
    isApi: true,
  });

  if (decision === "401") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (decision === "404") {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (decision === "403") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tree = await getMenuTreeForTenant({
    tenantSlug,
    subscriptionLevel: access.subscriptionLevel,
    userRoles: access.userRoles,
    isPlatformAdmin: access.isPlatformAdmin,
  });
  return NextResponse.json(tree);
}
