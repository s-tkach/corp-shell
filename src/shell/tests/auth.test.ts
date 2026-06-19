import { beforeEach, describe, expect, it, vi } from "vitest";

const nextAuthFactory = vi.fn();
const getMappedIdpRoleSlugsMock = vi.fn();
const replaceIdpRoleAssignmentsForUserMock = vi.fn();
const getEffectiveRoleAssignmentsForUserMock = vi.fn();
const schema = {
  users: {
    id: "users.id",
    email: "users.email",
    displayName: "users.displayName",
    idpSource: "users.idpSource",
    idpSubject: "users.idpSubject",
    lastLoginAt: "users.lastLoginAt",
  },
  roles: {
    id: "roles.id",
    slug: "roles.slug",
  },
  userRoles: {
    userId: "user_roles.userId",
    roleId: "user_roles.roleId",
  },
  userIdpRoles: {
    userId: "user_idp_roles.userId",
    roleId: "user_idp_roles.roleId",
  },
  idpGroupRoleMappings: {
    idpGroupName: "idp_group_role_mappings.idpGroupName",
    roleId: "idp_group_role_mappings.roleId",
  },
  subscriptionTiers: {
    slug: "subscription_tiers.slug",
    level: "subscription_tiers.level",
  },
  tenantSubscription: {
    expiresAt: "tenant_subscription.expiresAt",
    status: "tenant_subscription.status",
    tierId: "tenant_subscription.tierId",
    tenantId: "tenant_subscription.tenantId",
  },
  authEvents: {
    userId: "auth_events.userId",
    email: "auth_events.email",
    eventType: "auth_events.eventType",
  },
  tenants: {
    id: "tenants.id",
    slug: "tenants.slug",
  },
  userCompanies: {
    userId: "user_companies.userId",
    companyId: "user_companies.companyId",
  },
};

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

vi.mock("@/lib/db/schema", () => schema);
vi.mock("@/lib/role-assignments", () => ({
  getMappedIdpRoleSlugs: getMappedIdpRoleSlugsMock,
  replaceIdpRoleAssignmentsForUser: replaceIdpRoleAssignmentsForUserMock,
  getEffectiveRoleAssignmentsForUser: getEffectiveRoleAssignmentsForUserMock,
}));

function makeQuery(result: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function makeTenantQuery({
  whereResult,
  limitResult,
}: {
  whereResult?: unknown;
  limitResult?: unknown;
}) {
  const query = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn(),
    limit: vi.fn(),
  };

  if (limitResult !== undefined) {
    query.where.mockReturnValue(query);
    query.limit.mockResolvedValue(limitResult);
    return query;
  }

  query.where.mockResolvedValue(whereResult);
  return query;
}

const dbSelect = vi.fn();
vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelect,
  },
}));

const tenantDb = {
  select: vi.fn(),
  delete: vi.fn(),
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
    getMappedIdpRoleSlugsMock.mockResolvedValue([]);
    replaceIdpRoleAssignmentsForUserMock.mockResolvedValue(undefined);
    getEffectiveRoleAssignmentsForUserMock.mockResolvedValue({
      manualRoles: [{ slug: "super_admin", displayName: "Super Admin" }],
      idpRoles: [],
      effectiveRoles: [{ slug: "super_admin", displayName: "Super Admin" }],
    });

    tenantDb.select
      .mockImplementationOnce(() => makeTenantQuery({ limitResult: [] }))
      .mockImplementationOnce(() => makeTenantQuery({ limitResult: [{ id: "role-super-admin" }] }))
      .mockImplementationOnce(() => makeTenantQuery({ limitResult: [] }))
      .mockImplementationOnce(() => makeTenantQuery({ limitResult: [{ id: "role-super-admin" }] }))
      .mockImplementationOnce(() => makeTenantQuery({ whereResult: [] }));
    tenantDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    tenantDb.insert.mockReturnValue(tenantDb);
    tenantDb.values.mockReturnValue(tenantDb);
    tenantDb.returning.mockResolvedValue([{ id: "user-1" }]);
    tenantDb.update.mockReturnValue(tenantDb);
    tenantDb.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
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

  it("replaces only IDP-derived assignments on login while keeping manual roles separate", async () => {
    const { getTenantSlug, getPlatformSlug } = await import("@/lib/tenant-resolver");
    vi.mocked(getTenantSlug).mockReturnValue("acme");
    vi.mocked(getPlatformSlug).mockReturnValue("platform");
    dbSelect.mockReset();
    tenantDb.select.mockReset();
    nextAuthFactory.mockImplementation((factory) => ({
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      __factory: factory,
    }));

    dbSelect
      .mockImplementationOnce(() => makeQuery([{ id: "tenant-2", slug: "acme" }]))
      .mockImplementationOnce(() => makeQuery([{ slug: "standard", level: 1, expiresAt: null, status: "active" }]));
    getMappedIdpRoleSlugsMock.mockResolvedValue(["user"]);
    replaceIdpRoleAssignmentsForUserMock.mockResolvedValue(undefined);
    getEffectiveRoleAssignmentsForUserMock.mockResolvedValue({
      manualRoles: [{ slug: "admin", displayName: "Admin" }],
      idpRoles: [{ slug: "user", displayName: "User" }],
      effectiveRoles: [
        { slug: "admin", displayName: "Admin" },
        { slug: "user", displayName: "User" },
      ],
    });

    tenantDb.select
      .mockImplementationOnce(() => makeTenantQuery({ limitResult: [{ id: "existing-user-1", email: "existing@example.com" }] }))
      .mockImplementationOnce(() => makeTenantQuery({ whereResult: [{ companyId: "company-1" }] }));
    tenantDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    tenantDb.insert.mockReturnValue(tenantDb);
    tenantDb.values.mockReturnValue(tenantDb);
    tenantDb.update.mockReturnValue(tenantDb);
    tenantDb.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const authModule = await import("@/lib/auth");
    const factory = nextAuthFactory.mock.calls[0]?.[0];
    expect(authModule).toBeDefined();
    expect(factory).toBeTypeOf("function");

    const config = await factory({
      headers: new Headers({ host: "acme.corp.example.com" }),
    });

    const token = await config.callbacks.jwt({
      token: { email: "existing@example.com", sub: "sub-2", name: "Existing User" },
      account: { provider: "oidc", id_token: "id-token" },
      profile: { groups: ["Employees"] },
      trigger: "signIn",
    });

    expect(replaceIdpRoleAssignmentsForUserMock).toHaveBeenCalledWith(
      tenantDb,
      "existing-user-1",
      ["user"]
    );
    expect(token.roles).toEqual(expect.arrayContaining(["admin", "user"]));
  });
});
