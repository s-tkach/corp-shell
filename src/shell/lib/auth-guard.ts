import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db/tenant";
import { roles, rolePolicies } from "@/lib/db/schema";
import { getRequestAccessSnapshot } from "@/lib/request-access";
import { and, eq, inArray } from "drizzle-orm";

export async function requireRoles(requiredRoles: string[]): Promise<NextResponse | null> {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantSlug = session.user.tenantSlug ?? "";
  const access = await getRequestAccessSnapshot({
    tenantSlug,
    pathname: "",
    session,
  });
  if (access.outcome === "login") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (access.outcome === "not_found") {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (access.outcome !== "allow") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userRoles: string[] = access.userRoles;
  const hasRole = requiredRoles.some((r) => userRoles.includes(r));

  if (!hasRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function requirePolicy(policySlug: string): Promise<NextResponse | null> {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRoleSlugs: string[] = session.user.roles ?? [];
  if (userRoleSlugs.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantDb = await getTenantDb();

  const roleRows = await tenantDb
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.slug, userRoleSlugs));

  if (roleRows.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roleIds = roleRows.map((r) => r.id);

  const match = await tenantDb
    .select({ roleId: rolePolicies.roleId })
    .from(rolePolicies)
    .where(and(inArray(rolePolicies.roleId, roleIds), eq(rolePolicies.policySlug, policySlug)))
    .limit(1);

  if (match.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
