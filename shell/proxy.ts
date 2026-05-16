import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";

const ADMIN_ROUTES = ["/admin", "/api/admin"];
const ADMIN_ROLES = new Set(["super_admin", "admin"]);

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

  // Auth group routes are public (login, error pages)
  if (pathname.startsWith("/(auth)")) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/signin", request.url));
  }

  const roles: string[] = session.user.roles ?? [];

  if (isAdminRoute(pathname) && !hasAdminRole(roles)) {
    return NextResponse.rewrite(new URL("/403", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
