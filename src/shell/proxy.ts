import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { menuItems, shellConfig, tenants } from "@/lib/db/schema";
import { ADMIN_ROLES } from "@/lib/roles";
import { getTenantSlug } from "@/lib/tenant-resolver";
import { isTenantMismatch } from "@/lib/tenant-check";
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
  const host = request.headers.get("host") ?? "";
  const hostSlug = getTenantSlug(host);

  // At the login boundary: validate tenant exists and is active
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    if (hostSlug) {
      const tenantRows = await db
        .select({ status: tenants.status })
        .from(tenants)
        .where(eq(tenants.slug, hostSlug))
        .limit(1);
      const tenant = tenantRows[0];
      if (!tenant) {
        return new NextResponse("Tenant not found", { status: 404 });
      }
      if (tenant.status === "suspended") {
        return NextResponse.redirect(new URL("/suspended", request.url));
      }
      if (tenant.status === "deleted") {
        return new NextResponse("Tenant not found", { status: 404 });
      }
    }
  }

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

  // Cross-tenant token replay check — runs on every authenticated request
  if (isTenantMismatch(session.user.tenantSlug, hostSlug)) {
    return new NextResponse("Unauthorized — tenant mismatch", { status: 401 });
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
    "/((?!login|suspended|setup|api/auth|api/setup|api/internal|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
