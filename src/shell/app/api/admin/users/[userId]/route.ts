import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, userRoles, roles, userSubscriptions } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq, inArray } from "drizzle-orm";

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

  if (typeof body.isActive === "boolean") {
    await db.update(users).set({ isActive: body.isActive }).where(eq(users.id, userId));
  }

  if (Array.isArray(body.roleSlugs)) {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    if (body.roleSlugs.length > 0) {
      const roleRows = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, body.roleSlugs));
      if (roleRows.length > 0) {
        await db.insert(userRoles).values(roleRows.map((r) => ({ userId, roleId: r.id })));
      }
    }
  }

  if (body.tierId !== undefined) {
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
    await db.insert(userSubscriptions).values({
      userId,
      tierId: body.tierId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
  }

  return NextResponse.json({ ok: true });
}
