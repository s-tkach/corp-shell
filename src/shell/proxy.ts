import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { menuItems, shellConfig } from "@/lib/db/schema";
import { ADMIN_ROLES } from "@/lib/roles";
import { eq } from "drizzle-orm";

const ADMIN_ROUTES = ["/admin", "/api/admin"];

async function getSetupComplete(): Promise<boolean> {
  const rows = await db
    .select({ setupComplete: shellConfig.setupComplete })
    .from(shellConfig)
    .limit(1);
  return rows[0]?.setupComplete ?? false;
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function hasAdminRole(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.has(r));
}

async function getRequiredSubLevel(pathname: string): Promise<number | null> {
  const rows = await db
    .select({ requiredSubLevel: menuItems.requiredSubLevel })
    .from(menuItems)
    .where(eq(menuItems.route, pathname))
    .limit(1);
  const row = rows[0];
  if (!row || row.requiredSubLevel === 0) return null;
  return row.requiredSubLevel;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const setupComplete = await getSetupComplete();

  if (!setupComplete) {
    if (pathname !== "/setup") {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next();
  }

  // Setup is complete — /setup is now inaccessible
  if (pathname === "/setup") {
    return new NextResponse(null, { status: 404 });
  }

  const session = await auth();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const roles: string[] = session.user.roles ?? [];

  if (isAdminRoute(pathname) && !hasAdminRole(roles)) {
    return NextResponse.rewrite(new URL("/403", request.url));
  }

  // Subscription gate: skip for /upgrade itself to avoid redirect loop
  if (!pathname.startsWith("/upgrade") && !isAdminRoute(pathname)) {
    const requiredLevel = await getRequiredSubLevel(pathname);
    if (requiredLevel !== null) {
      const userLevel: number = session.user.subscriptionLevel ?? 0;
      if (userLevel < requiredLevel) {
        const upgradeUrl = new URL("/upgrade", request.url);
        upgradeUrl.searchParams.set("from", pathname);
        upgradeUrl.searchParams.set("level", String(requiredLevel));
        return NextResponse.redirect(upgradeUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|setup|api/auth|api/setup|api/internal|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
