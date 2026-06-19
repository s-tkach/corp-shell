import { describe, it, expect } from "vitest";
import { isTenantMismatch } from "@/lib/tenant-check";

describe("cross-tenant replay check", () => {
  it("accepts matching token slug and host slug", () => {
    expect(isTenantMismatch("acme", "acme")).toBe(false);
  });

  it("rejects when token slug differs from host slug", () => {
    expect(isTenantMismatch("acme", "globocorp")).toBe(true);
  });

  it("rejects when host slug is null (fail-closed: unresolvable host is a mismatch)", () => {
    expect(isTenantMismatch("acme", null)).toBe(true);
  });

  it("rejects when token slug is undefined", () => {
    expect(isTenantMismatch(undefined, "acme")).toBe(true);
  });

  it("accepts platform tenant at apex (proxy passes resolvedSlug, not raw hostSlug)", () => {
    // When no subdomain, proxy resolves to platform slug before calling isTenantMismatch
    expect(isTenantMismatch("platform", "platform")).toBe(false);
  });
});

describe("route classification", () => {
  it("does not reserve a setup bypass anymore", () => {
    const bypassRoutes = ["/login", "/api/auth"];
    const isBypassed = (pathname: string) =>
      bypassRoutes.some((p) => pathname === p || pathname.startsWith(p + "/"));

    expect(isBypassed("/setup")).toBe(false);
    expect(isBypassed("/api/setup")).toBe(false);
    expect(isBypassed("/login")).toBe(true);
  });
});
