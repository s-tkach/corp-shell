import { describe, expect, it } from "vitest";
import { evaluateProtectedRequestAccess } from "@/lib/request-access";

describe("evaluateProtectedRequestAccess", () => {
  it("returns login for an inactive user on the next protected request", () => {
    expect(
      evaluateProtectedRequestAccess({
        requestTenantSlug: "acme",
        sessionTenantSlug: "acme",
        tenantExists: true,
        tenantStatus: "active",
        sessionUserId: "user-1",
        userExists: true,
        userIsActive: false,
        routeAccess: "allow",
      })
    ).toBe("login");
  });

  it("returns forbidden for a tenant mismatch before the request continues", () => {
    expect(
      evaluateProtectedRequestAccess({
        requestTenantSlug: "acme",
        sessionTenantSlug: "globocorp",
        tenantExists: true,
        tenantStatus: "active",
        sessionUserId: "user-1",
        userExists: true,
        userIsActive: true,
        routeAccess: "allow",
      })
    ).toBe("forbidden");
  });

  it("returns the menu-backed route outcome when auth state is otherwise valid", () => {
    expect(
      evaluateProtectedRequestAccess({
        requestTenantSlug: "acme",
        sessionTenantSlug: "acme",
        tenantExists: true,
        tenantStatus: "active",
        sessionUserId: "user-1",
        userExists: true,
        userIsActive: true,
        routeAccess: "upgrade",
      })
    ).toBe("upgrade");
  });
});
