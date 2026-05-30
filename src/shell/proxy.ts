import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { menuItems, shellConfig, tenants } from "@/lib/db/schema";
import { ADMIN_ROLES } from "@/lib/roles";
import { getTenantSlug, getPlatformSlug } from "@/lib/tenant-resolver";
import { isTenantMismatch } from "@/lib/tenant-check";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { withTenant } from "@/lib/db/tenant";
import { autoBootstrapPlatform } from "@/lib/db/provision";
import { eq } from "drizzle-orm";

const TENANT_ADMIN_ROUTES = ["/settings", "/api/settings"];
const PLATFORM_ROUTES = ["/platform", "/api/platform"];
const SETUP_ROUTES = ["/setup", "/api/setup"];

function isSetupRoute(pathname: string): boolean {
  return SETUP_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function ensurePlatformTenant(): Promise<boolean> {
  const rows = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (rows.length > 0) return true;

  await autoBootstrapPlatform();

  const check = await db.select({ id: tenants.id }).from(tenants).limit(1);
  return check.length > 0;
}

async function isTenantReady(tenantSlug: string): Promise<boolean> {
  try {
    const tenantDb = withTenant(tenantSlug);
    const rows = await tenantDb
      .select({ setupComplete: shellConfig.setupComplete })
      .from(shellConfig)
      .limit(1);
    return rows[0]?.setupComplete ?? false;
  } catch (e) {
    console.error(`[proxy] isTenantReady("${tenantSlug}") error:`, e instanceof Error ? e.message : e);
    return false;
  }
}

function isTenantAdminRoute(pathname: string): boolean {
  return TENANT_ADMIN_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function isPlatformRoute(pathname: string): boolean {
  return PLATFORM_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function hasAdminRole(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.has(r));
}

async function getRequiredSubLevel(pathname: string, tenantSlug: string): Promise<number | null> {
  const tenantDb = withTenant(tenantSlug);
  const rows = await tenantDb
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

  // Always ensure the platform tenant exists (auto-bootstrap on first visit)
  try {
    const bootstrapped = await ensurePlatformTenant();
    if (!bootstrapped) {
      return new NextResponse("Platform bootstrap failed — tenant not created", { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[proxy] Platform bootstrap error:", msg);
    return new NextResponse(`Platform bootstrap error: ${msg}`, { status: 500 });
  }

  // Setup routes bypass all remaining gates — they run before any tenant is ready
  if (isSetupRoute(pathname)) return NextResponse.next();

  const resolvedSlug = hostSlug ?? getPlatformSlug();

  // Verify the resolved tenant exists and is ready
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, resolvedSlug))
    .limit(1);
  if (tenantRows.length === 0) {
    return new NextResponse("Tenant not found", { status: 404 });
  }

  if (!await isTenantReady(resolvedSlug)) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const session = await auth();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Cross-tenant token replay check — runs on every authenticated request.
  // Use resolvedSlug (falls back to platform slug at apex) so platform users
  // served at the root domain are not rejected when hostSlug is null.
  if (isTenantMismatch(session.user.tenantSlug, resolvedSlug)) {
    return new NextResponse("Unauthorized — tenant mismatch", { status: 401 });
  }

  const roles: string[] = session.user.roles ?? [];

  // Platform routes: require platform tenant + super_admin
  if (isPlatformRoute(pathname)) {
    if (!isPlatformAdmin({ roles, tenantSlug: session.user.tenantSlug ?? "" })) {
      return NextResponse.rewrite(new URL("/403", request.url));
    }
  }

  // Tenant admin routes: require admin or super_admin role
  if (isTenantAdminRoute(pathname) && !hasAdminRole(roles)) {
    return NextResponse.rewrite(new URL("/403", request.url));
  }

  const tenantSlug = session.user.tenantSlug ?? "";

  // Subscription gate: skip for /upgrade itself to avoid redirect loop
  if (tenantSlug && !pathname.startsWith("/upgrade") && !isTenantAdminRoute(pathname) && !isPlatformRoute(pathname)) {
    const requiredLevel = await getRequiredSubLevel(pathname, tenantSlug);
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
    "/((?!login|suspended|api/auth|api/internal|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
