import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMenuTreeForTenant } from "@/lib/menu";
import { isPlatformAdmin } from "@/lib/platform-guard";

export type { MenuItem, MenuSection } from "@/lib/menu";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantSlug: string = session.user.tenantSlug ?? "";
  const subscriptionLevel: number = session.user.subscriptionLevel ?? 0;
  const userRoles: string[] = session.user.roles ?? [];
  const platformAdmin = isPlatformAdmin({
    roles: userRoles,
    tenantSlug,
  });

  const tree = await getMenuTreeForTenant({
    tenantSlug,
    subscriptionLevel,
    userRoles,
    isPlatformAdmin: platformAdmin,
  });
  return NextResponse.json(tree);
}
