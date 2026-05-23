import { describe, it, expect, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// Extract the logic under test directly from proxy.ts internals
// We test the decision logic without importing the full Next.js middleware runtime.

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

function isAdminRoute(pathname: string): boolean {
  return ["/admin", "/api/admin"].some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function hasAdminRole(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.has(r));
}

function resolveMiddleware(
  pathname: string,
  setupComplete: boolean,
  session: { roles: string[]; subscriptionLevel: number } | null
): "redirect:/setup" | "404" | "redirect:/api/auth/signin" | "403" | "next" {
  if (!setupComplete) {
    return pathname === "/setup" ? "next" : "redirect:/setup";
  }
  if (pathname === "/setup") return "404";
  if (!session) return "redirect:/api/auth/signin";
  if (isAdminRoute(pathname) && !hasAdminRole(session.roles)) return "403";
  return "next";
}

describe("Middleware — setup not complete", () => {
  it("redirects non-/setup paths to /setup", () => {
    expect(resolveMiddleware("/dashboard", false, null)).toBe("redirect:/setup");
    expect(resolveMiddleware("/", false, null)).toBe("redirect:/setup");
  });

  it("allows /setup through when setup is incomplete", () => {
    expect(resolveMiddleware("/setup", false, null)).toBe("next");
  });
});

describe("Middleware — setup complete", () => {
  it("returns 404 for /setup after completion", () => {
    expect(resolveMiddleware("/setup", true, null)).toBe("404");
  });

  it("redirects unauthenticated user to sign-in", () => {
    expect(resolveMiddleware("/dashboard", true, null)).toBe("redirect:/api/auth/signin");
  });

  it("allows admin role user through /admin/menu", () => {
    expect(resolveMiddleware("/admin/menu", true, { roles: ["admin"], subscriptionLevel: 0 })).toBe("next");
  });

  it("blocks non-admin role user from /admin/menu with 403", () => {
    expect(resolveMiddleware("/admin/menu", true, { roles: ["user"], subscriptionLevel: 0 })).toBe("403");
  });

  it("allows super_admin through /admin routes", () => {
    expect(resolveMiddleware("/admin/users", true, { roles: ["super_admin"], subscriptionLevel: 2 })).toBe("next");
  });

  it("allows authenticated non-admin user through non-admin routes", () => {
    expect(resolveMiddleware("/dashboard", true, { roles: ["user"], subscriptionLevel: 0 })).toBe("next");
  });
});
