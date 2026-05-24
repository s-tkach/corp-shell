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
