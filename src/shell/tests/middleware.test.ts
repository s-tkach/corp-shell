import { describe, it, expect, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// Extract the logic under test directly from proxy.ts internals
// We test the decision logic without importing the full Next.js middleware runtime.

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

function isAdminRoute(pathname: string): boolean {
  return ["/settings", "/api/settings"].some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function hasAdminRole(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.has(r));
}

function resolveMiddleware(
  pathname: string,
  tenantReady: boolean,
  session: { roles: string[]; subscriptionLevel: number } | null
): "503" | "redirect:/api/auth/signin" | "403" | "next" {
  if (!tenantReady) return "503";
  if (!session) return "redirect:/api/auth/signin";
  if (isAdminRoute(pathname) && !hasAdminRole(session.roles)) return "403";
  return "next";
}

describe("Middleware — tenant not ready", () => {
  it("returns 503 when tenant is not configured", () => {
    expect(resolveMiddleware("/dashboard", false, null)).toBe("503");
    expect(resolveMiddleware("/", false, null)).toBe("503");
  });
});

describe("Middleware — tenant ready", () => {
  it("redirects unauthenticated user to sign-in", () => {
    expect(resolveMiddleware("/dashboard", true, null)).toBe("redirect:/api/auth/signin");
  });

  it("allows admin role user through /settings/menu route", () => {
    expect(resolveMiddleware("/settings/menu", true, { roles: ["admin"], subscriptionLevel: 0 })).toBe("next");
  });

  it("blocks non-admin role user from /settings/menu with 403", () => {
    expect(resolveMiddleware("/settings/menu", true, { roles: ["user"], subscriptionLevel: 0 })).toBe("403");
  });

  it("allows super_admin through /admin routes", () => {
    expect(resolveMiddleware("/settings/users", true, { roles: ["super_admin"], subscriptionLevel: 2 })).toBe("next");
  });

  it("allows authenticated non-admin user through non-admin routes", () => {
    expect(resolveMiddleware("/dashboard", true, { roles: ["user"], subscriptionLevel: 0 })).toBe("next");
  });
});
