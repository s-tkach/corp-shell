import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db/schema", () => ({
  shellConfig: {},
  roles: {},
  users: {},
  userRoles: {},
  idpProviders: {},
}));
vi.mock("@/lib/db/tenant", () => ({
  withTenant: vi.fn(),
}));
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(async (pt: string) => `encrypted:${pt}`),
}));
vi.mock("@/lib/tenant-resolver", () => ({
  getPlatformSlug: vi.fn(() => "platform"),
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

function makeMockTenantDb(setupComplete = false) {
  const db = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };

  // Default chain: select().from().where().limit() -> returns setupComplete check
  db.select.mockReturnValue(db);
  db.from.mockReturnValue(db);
  db.where.mockReturnValue(db);
  db.limit.mockResolvedValue([{ setupComplete }]);

  // insert().values() -> resolves (for userRoles, idpProviders)
  db.insert.mockReturnValue(db);
  db.values.mockResolvedValue(undefined);
  // insert().values().returning() -> for roles and users
  db.returning.mockResolvedValue([{ id: "role-id" }]);

  // update().set() -> resolves
  db.update.mockReturnValue(db);
  db.set.mockResolvedValue(undefined);

  return db;
}

describe("POST /api/setup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 409 when setup is already complete", async () => {
    const { withTenant } = await import("@/lib/db/tenant");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(withTenant).mockReturnValue(makeMockTenantDb(true) as any);

    const { POST } = await import("@/app/api/setup/route");
    const req = new Request("http://localhost/api/setup", {
      method: "POST",
      body: JSON.stringify({
        adminEmail: "admin@example.com",
        oidcIssuer: "https://example.com",
        oidcClientId: "client-id",
        oidcClientSecret: "client-secret",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when adminEmail is missing", async () => {
    const { withTenant } = await import("@/lib/db/tenant");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(withTenant).mockReturnValue(makeMockTenantDb(false) as any);

    const { POST } = await import("@/app/api/setup/route");
    const req = new Request("http://localhost/api/setup", {
      method: "POST",
      body: JSON.stringify({
        oidcIssuer: "https://example.com",
        oidcClientId: "client-id",
        oidcClientSecret: "client-secret",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const { withTenant } = await import("@/lib/db/tenant");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(withTenant).mockReturnValue(makeMockTenantDb(false) as any);

    const { POST } = await import("@/app/api/setup/route");
    const req = new Request("http://localhost/api/setup", {
      method: "POST",
      body: JSON.stringify({
        adminEmail: "not-an-email",
        oidcIssuer: "https://example.com",
        oidcClientId: "client-id",
        oidcClientSecret: "client-secret",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
