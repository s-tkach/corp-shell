import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockIsPlatformAdmin,
  mockDb,
  mockProvisionTenant,
  mockWithTenant,
  mockEncrypt,
  mockEq,
  mockAsc,
  mockAnd,
} = vi.hoisted(() => {
  const db = {
    select: vi.fn(),
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
  };

  return {
    mockAuth: vi.fn(),
    mockIsPlatformAdmin: vi.fn(),
    mockDb: db,
    mockProvisionTenant: vi.fn(),
    mockWithTenant: vi.fn(),
    mockEncrypt: vi.fn(async (pt: string) => `encrypted:${pt}`),
    mockEq: vi.fn(),
    mockAsc: vi.fn(),
    mockAnd: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/platform-guard", () => ({ isPlatformAdmin: mockIsPlatformAdmin }));
vi.mock("@/lib/db/client", () => ({
  db: mockDb,
  connectionString: "postgres://localhost/test",
}));
vi.mock("@/lib/db/provision", () => ({ provisionTenant: mockProvisionTenant }));
vi.mock("@/lib/db/schema", () => ({
  tenants: { id: "tenants.id", slug: "tenants.slug", displayName: "tenants.displayName", status: "tenants.status", isPlatform: "tenants.isPlatform", createdAt: "tenants.createdAt" },
  idpProviders: {},
  shellConfig: {},
  subscriptionTiers: { id: "subscriptionTiers.id", slug: "subscriptionTiers.slug", displayName: "subscriptionTiers.displayName", level: "subscriptionTiers.level" },
  tenantSubscription: { tenantId: "tenantSubscription.tenantId", tierId: "tenantSubscription.tierId" },
}));
vi.mock("@/lib/db/tenant", () => ({
  withTenant: mockWithTenant,
}));
vi.mock("@/lib/crypto", () => ({ encrypt: mockEncrypt }));
vi.mock("drizzle-orm", () => ({ eq: mockEq, asc: mockAsc, and: mockAnd }));

function makeTenantDb() {
  return {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue(undefined),
  };
}

function mockTenantSelectResult(rows: unknown[]) {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  });
}

function mockTierLookupResult(rows: unknown[]) {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function mockDuplicateTenantLookup(rows: unknown[]) {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

describe("/api/platform/tenants", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { roles: ["super_admin"], tenantSlug: "platform" } });
    mockIsPlatformAdmin.mockReturnValue(true);
    mockProvisionTenant.mockResolvedValue({ tenantId: "tenant-123" });
    mockWithTenant.mockReturnValue(makeTenantDb());
  });

  describe("POST", () => {
    it("returns 403 for non-platform admins", async () => {
      mockAuth.mockResolvedValue({ user: { roles: ["admin"], tenantSlug: "acme" } });
      mockIsPlatformAdmin.mockReturnValue(false);

      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "new",
          displayName: "New",
          adminEmail: "a@b.com",
          tierId: "tier-standard",
          oidcIssuer: "https://example.com",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid slug", async () => {
      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "INVALID SLUG!",
          displayName: "New",
          adminEmail: "a@b.com",
          tierId: "tier-standard",
          oidcIssuer: "https://example.com",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);
      expect(res.status).toBe(400);
    });

    it("returns 400 when tierId is missing", async () => {
      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "new",
          displayName: "New",
          adminEmail: "a@b.com",
          oidcIssuer: "https://example.com",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);
      expect(res.status).toBe(400);
    });

    it("returns 400 when tierId does not exist", async () => {
      mockTierLookupResult([]);

      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "new",
          displayName: "New",
          adminEmail: "a@b.com",
          tierId: "tier-missing",
          oidcIssuer: "https://example.com",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);
      expect(res.status).toBe(400);
      expect(mockProvisionTenant).not.toHaveBeenCalled();
    });

    it("rejects private OIDC issuer targets server-side", async () => {
      global.fetch = vi.fn();
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "tier-standard" }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "new",
          displayName: "New",
          adminEmail: "a@b.com",
          tierId: "tier-standard",
          oidcIssuer: "https://127.0.0.1/oidc",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);
      const body = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(body.error).toBe("oidcIssuer must be a valid public HTTPS URL");
      expect(body.error).not.toContain("127.0.0.1");
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockProvisionTenant).not.toHaveBeenCalled();
    });

    it("rejects unreachable OIDC issuers before provisioning", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND broken.example.com"));
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "tier-standard" }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "new",
          displayName: "New",
          adminEmail: "a@b.com",
          tierId: "tier-standard",
          oidcIssuer: "https://broken.example.com",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "OIDC discovery failed",
      });
      expect(mockProvisionTenant).not.toHaveBeenCalled();
    });

    it("creates a tenant with the selected tier", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: "https://example.com",
          authorization_endpoint: "https://example.com/auth",
        }),
      } as Response);
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "tier-standard" }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      const { POST } = await import("@/app/api/platform/tenants/route");
      const req = new Request("http://localhost/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: "new",
          displayName: "New",
          adminEmail: "a@b.com",
          tierId: "tier-standard",
          oidcIssuer: "https://example.com",
          oidcClientId: "id",
          oidcClientSecret: "secret",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req as Parameters<typeof POST>[0]);

      expect(res.status).toBe(201);
      expect(mockProvisionTenant).toHaveBeenCalledWith("new", "New", "a@b.com", "tier-standard");
    });
  });

  describe("GET", () => {
    it("returns tenant rows with current tier metadata", async () => {
      mockTenantSelectResult([
        {
          id: "tenant-1",
          slug: "acme",
          displayName: "Acme",
          status: "active",
          isPlatform: false,
          createdAt: "2026-06-14T00:00:00.000Z",
          tierId: "tier-standard",
          tierSlug: "standard",
          tierDisplayName: "Standard",
          tierLevel: 1,
        },
      ]);

      const { GET } = await import("@/app/api/platform/tenants/route");
      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body[0]).toMatchObject({
        tierId: "tier-standard",
        tierSlug: "standard",
        tierDisplayName: "Standard",
        tierLevel: 1,
      });
    });
  });

  describe("PATCH /api/platform/tenants/[tenantId]", () => {
    it("updates a non-platform tenant tier", async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ slug: "acme" }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "tier-enterprise" }]),
            }),
          }),
        });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const { PATCH } = await import("@/app/api/platform/tenants/[tenantId]/route");
      const req = new Request("http://localhost/api/platform/tenants/tenant-1", {
        method: "PATCH",
        body: JSON.stringify({ tierId: "tier-enterprise" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req as Parameters<typeof PATCH>[0], {
        params: Promise.resolve({ tenantId: "tenant-1" }),
      });

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("rejects platform tenant tier changes", async () => {
      mockDuplicateTenantLookup([{ slug: "platform" }]);

      const { PATCH } = await import("@/app/api/platform/tenants/[tenantId]/route");
      const req = new Request("http://localhost/api/platform/tenants/tenant-platform", {
        method: "PATCH",
        body: JSON.stringify({ tierId: "tier-standard" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req as Parameters<typeof PATCH>[0], {
        params: Promise.resolve({ tenantId: "tenant-platform" }),
      });

      expect(res.status).toBe(400);
    });
  });
});
