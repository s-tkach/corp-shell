import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db/tenant";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface UserPreferences {
  sidebarCollapsed?: boolean;
  theme?: "light" | "dark" | "system";
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantDb = await getTenantDb();
  const body = (await request.json()) as Partial<UserPreferences>;
  const patch: UserPreferences = {};

  if (typeof body.sidebarCollapsed === "boolean") {
    patch.sidebarCollapsed = body.sidebarCollapsed;
  }
  if (body.theme === "light" || body.theme === "dark" || body.theme === "system") {
    patch.theme = body.theme;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const existing = await tenantDb
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const current = (existing[0]?.preferences as UserPreferences | null) ?? {};
  const updated = { ...current, ...patch };

  await tenantDb
    .update(users)
    .set({ preferences: updated })
    .where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
