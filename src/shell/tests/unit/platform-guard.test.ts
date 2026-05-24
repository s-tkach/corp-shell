import { describe, it, expect } from "vitest";
import { isPlatformAdmin } from "@/lib/platform-guard";

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
});
