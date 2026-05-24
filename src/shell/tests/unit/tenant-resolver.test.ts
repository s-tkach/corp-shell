import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getTenantSlug", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts subdomain from a three-part hostname", async () => {
    const { getTenantSlug } = await import("@/lib/tenant-resolver");
    expect(getTenantSlug("acme.corp.example.com")).toBe("acme");
  });

  it("extracts subdomain from a two-part hostname with one sub", async () => {
    const { getTenantSlug } = await import("@/lib/tenant-resolver");
    expect(getTenantSlug("acme.example.com")).toBe("acme");
  });

  it("returns null for a bare hostname with no subdomain", async () => {
    const { getTenantSlug } = await import("@/lib/tenant-resolver");
    expect(getTenantSlug("example.com")).toBeNull();
  });

  it("strips port from host before extracting", async () => {
    const { getTenantSlug } = await import("@/lib/tenant-resolver");
    expect(getTenantSlug("acme.localhost:3000")).toBe("acme");
  });

  it("returns null for bare localhost", async () => {
    const { getTenantSlug } = await import("@/lib/tenant-resolver");
    expect(getTenantSlug("localhost:3000")).toBeNull();
  });

  it("returns TENANT_SLUG env override when set", async () => {
    vi.stubEnv("TENANT_SLUG", "devtenant");
    const { getTenantSlug } = await import("@/lib/tenant-resolver");
    expect(getTenantSlug("localhost:3000")).toBe("devtenant");
  });
});
