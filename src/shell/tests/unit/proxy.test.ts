import { describe, it, expect } from "vitest";
import { isTenantMismatch } from "@/lib/tenant-check";

describe("cross-tenant replay check", () => {
  it("accepts matching token slug and host slug", () => {
    expect(isTenantMismatch("acme", "acme")).toBe(false);
  });

  it("rejects when token slug differs from host slug", () => {
    expect(isTenantMismatch("acme", "globocorp")).toBe(true);
  });

  it("accepts when host slug is null (no subdomain — dev/platform)", () => {
    expect(isTenantMismatch("acme", null)).toBe(false);
  });
});

describe("setup route bypass", () => {
  it("identifies setup routes correctly", () => {
    const SETUP_ROUTES = ["/setup", "/api/setup"];
    const isSetupRoute = (pathname: string) =>
      SETUP_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));

    expect(isSetupRoute("/setup")).toBe(true);
    expect(isSetupRoute("/api/setup")).toBe(true);
    expect(isSetupRoute("/api/setup/validate-oidc")).toBe(true);
    expect(isSetupRoute("/login")).toBe(false);
    expect(isSetupRoute("/admin")).toBe(false);
    expect(isSetupRoute("/setupx")).toBe(false);
  });
});
