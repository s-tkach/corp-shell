import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import {
  getRequestAccessSnapshot,
  mapRequestAccessOutcomeToDecision,
} from "@/lib/request-access";
import { ADMIN_ROLES } from "@/lib/roles";
import { getTenantSlug, getPlatformSlug } from "@/lib/tenant-resolver";
import { autoBootstrapPlatform } from "@/lib/db/provision";
import { eq } from "drizzle-orm";

const TENANT_ADMIN_ROUTES = ["/settings", "/api/settings"];
const PLATFORM_ROUTES = ["/platform", "/api/platform"];

async function ensurePlatformTenant(): Promise<boolean> {
  await autoBootstrapPlatform();

  const check = await db.select({ id: tenants.id }).from(tenants).limit(1);
  return check.length > 0;
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

  const resolvedSlug = hostSlug ?? getPlatformSlug();
  const session = await auth();
  const access = await getRequestAccessSnapshot({
    tenantSlug: resolvedSlug,
    pathname,
    session,
  });
  const isApi = pathname.startsWith("/api/");
  const decision = mapRequestAccessOutcomeToDecision({
    outcome: access.outcome,
    pathname,
    isApi,
  });

  if (decision === "404") {
    return new NextResponse("Tenant not found", { status: 404 });
  }

  if (decision === "401") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (decision === "403") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (decision === "redirect:/login") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (decision === "redirect:/suspended") {
    return NextResponse.redirect(new URL("/suspended", request.url));
  }

  if (decision === "redirect:/upgrade") {
    const upgradeUrl = new URL("/upgrade", request.url);
    upgradeUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(upgradeUrl);
  }

  if (decision === "rewrite:/403") {
    return NextResponse.rewrite(new URL("/403", request.url));
  }

  const roles = access.userRoles;

  // Platform routes: require platform tenant + super_admin
  if (isPlatformRoute(pathname)) {
    if (!access.isPlatformAdmin) {
      return isApi
        ? new NextResponse("Forbidden", { status: 403 })
        : NextResponse.rewrite(new URL("/403", request.url));
    }
  }

  // Tenant admin routes: require admin or super_admin role
  if (isTenantAdminRoute(pathname) && !hasAdminRole(roles)) {
    return isApi
      ? new NextResponse("Forbidden", { status: 403 })
      : NextResponse.rewrite(new URL("/403", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|suspended|api/auth|api/internal|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
