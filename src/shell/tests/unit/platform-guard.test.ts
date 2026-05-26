import { describe, it, expect, afterEach } from "vitest";
import { isPlatformAdmin } from "@/lib/platform-guard";

afterEach(() => {
  delete process.env["TENANT_SLUG"];
});

describe("isPlatformAdmin", () => {
  it("returns true for super_admin in platform tenant", () => {
    expect(isPlatformAdmin({ roles: ["super_admin"], tenantSlug: "platform" })).toBe(true);
  });

  it("returns false for super_admin in non-platform tenant", () => {
    expect(isPlatformAdmin({ roles: ["super_admin"], tenantSlug: "acme" })).toBe(false);
  });

  it("returns false for admin (not super_admin) in platform tenant", () => {
    expect(isPlatformAdmin({ roles: ["admin"], tenantSlug: "platform" })).toBe(false);
  });

  it("uses TENANT_SLUG as platform slug when set", () => {
    process.env["TENANT_SLUG"] = "corp-admin";
    expect(isPlatformAdmin({ roles: ["super_admin"], tenantSlug: "corp-admin" })).toBe(true);
  });

  it("returns false when TENANT_SLUG set but tenant does not match", () => {
    process.env["TENANT_SLUG"] = "corp-admin";
    expect(isPlatformAdmin({ roles: ["super_admin"], tenantSlug: "platform" })).toBe(false);
  });
});
