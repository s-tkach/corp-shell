import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/platform-guard", () => ({ isPlatformAdmin: vi.fn() }));
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
  },
  connectionString: "postgres://localhost/test",
}));
vi.mock("@/lib/db/provision", () => ({ provisionTenant: vi.fn() }));
vi.mock("@/lib/db/schema", () => ({ tenants: {}, idpProviders: {}, shellConfig: {} }));
vi.mock("@/lib/db/tenant", () => ({
  withTenant: vi.fn(() => ({
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("@/lib/crypto", () => ({ encrypt: vi.fn(async (pt: string) => `encrypted:${pt}`) }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), asc: vi.fn() }));

describe("POST /api/platform/tenants", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 403 for non-platform admins", async () => {
    const { auth } = await import("@/lib/auth");
    const { isPlatformAdmin } = await import("@/lib/platform-guard");
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["admin"], tenantSlug: "acme" } } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(isPlatformAdmin).mockReturnValue(false);

    const { POST } = await import("@/app/api/platform/tenants/route");
    const req = new Request("http://localhost/api/platform/tenants", {
      method: "POST",
      body: JSON.stringify({ slug: "new", displayName: "New", adminEmail: "a@b.com", oidcIssuer: "https://example.com", oidcClientId: "id", oidcClientSecret: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid slug", async () => {
    const { auth } = await import("@/lib/auth");
    const { isPlatformAdmin } = await import("@/lib/platform-guard");
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["super_admin"], tenantSlug: "platform" } } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(isPlatformAdmin).mockReturnValue(true);

    const { POST } = await import("@/app/api/platform/tenants/route");
    const req = new Request("http://localhost/api/platform/tenants", {
      method: "POST",
      body: JSON.stringify({ slug: "INVALID SLUG!", displayName: "New", adminEmail: "a@b.com", oidcIssuer: "https://example.com", oidcClientId: "id", oidcClientSecret: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });
});
