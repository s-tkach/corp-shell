import { beforeEach, describe, expect, it, vi } from "vitest";

const nextAuthFactory = vi.fn();

vi.mock("next-auth", () => ({
  default: nextAuthFactory,
}));

vi.mock("@/lib/auth-config", () => ({
  getAuthConfig: vi.fn(async () => ({ providers: [{ id: "oidc" }] })),
}));

vi.mock("@/lib/tenant-resolver", () => ({
  getTenantSlug: vi.fn(() => null),
  getPlatformSlug: vi.fn(() => "platform"),
}));

function makeQuery(result: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

const dbSelect = vi.fn();
vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelect,
  },
}));

const tenantDb = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  innerJoin: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

vi.mock("@/lib/db/tenant", () => ({
  withTenant: vi.fn(() => tenantDb),
}));

describe("auth bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthFactory.mockImplementation((factory) => ({
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      __factory: factory,
    }));

    dbSelect
      .mockImplementationOnce(() => makeQuery([{ id: "tenant-1", slug: "platform" }]))
      .mockImplementationOnce(() => makeQuery([{ slug: "free", level: 0, expiresAt: null, status: "active" }]));

    tenantDb.select.mockImplementation(() => tenantDb);
    tenantDb.from.mockReturnValue(tenantDb);
    tenantDb.where
      .mockReturnValueOnce(tenantDb)
      .mockReturnValueOnce(tenantDb)
      .mockReturnValueOnce(tenantDb)
      .mockResolvedValueOnce([{ id: "role-super-admin" }])
      .mockResolvedValueOnce([]);
    tenantDb.innerJoin.mockReturnValue(tenantDb);
    tenantDb.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "role-super-admin" }])
      .mockResolvedValueOnce([]);
    tenantDb.insert.mockReturnValue(tenantDb);
    tenantDb.values.mockReturnValue(tenantDb);
    tenantDb.returning.mockResolvedValue([{ id: "user-1" }]);
    tenantDb.update.mockReturnValue(tenantDb);
    tenantDb.set.mockReturnValue(tenantDb);
  });

  it("grants super_admin on the first successful platform login", async () => {
    const authModule = await import("@/lib/auth");
    const factory = nextAuthFactory.mock.calls[0]?.[0];
    expect(authModule).toBeDefined();
    expect(factory).toBeTypeOf("function");

    const config = await factory({
      headers: new Headers({ host: "corp.example.com" }),
    });

    const token = await config.callbacks.jwt({
      token: { email: "first-admin@example.com", sub: "sub-1", name: "First Admin" },
      account: { provider: "oidc", id_token: "id-token" },
      profile: {},
      trigger: "signIn",
    });

    expect(token.roles).toContain("super_admin");
  });
});
