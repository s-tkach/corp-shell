import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/db/tenant";
import { users, userRoles, roles, tenantSubscription } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq, inArray } from "drizzle-orm";
import { getTenantSlug } from "@/lib/tenant-slug";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const { userId } = await params;
  const body = await req.json() as {
    isActive?: boolean;
    roleSlugs?: string[];
    tierId?: string;
    expiresAt?: string | null;
  };

  const tenantSlug = getTenantSlug();
  const tenantDb = withTenant(tenantSlug);

  if (typeof body.isActive === "boolean") {
    await tenantDb.update(users).set({ isActive: body.isActive }).where(eq(users.id, userId));
  }

  if (Array.isArray(body.roleSlugs)) {
    await tenantDb.delete(userRoles).where(eq(userRoles.userId, userId));
    if (body.roleSlugs.length > 0) {
      const roleRows = await tenantDb
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, body.roleSlugs));
      if (roleRows.length > 0) {
        await tenantDb.insert(userRoles).values(roleRows.map((r) => ({ userId, roleId: r.id })));
      }
    }
  }

  if (body.tierId !== undefined) {
    await tenantDb.delete(tenantSubscription).where(eq(tenantSubscription.tierId, body.tierId));
    await tenantDb.insert(tenantSubscription).values({
      tierId: body.tierId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
  }

  return NextResponse.json({ ok: true });
}
