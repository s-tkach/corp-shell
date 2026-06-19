import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireRolesMock = vi.fn();
const authMock = vi.fn();
const getEffectiveRoleAssignmentsForUserMock = vi.fn();

const tenantDb = {
  select: vi.fn(),
  from: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  where: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

const db = {
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

vi.mock("@/lib/auth-guard", () => ({
  requireRoles: requireRolesMock,
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db/tenant", () => ({
  withTenant: vi.fn(() => tenantDb),
}));

vi.mock("@/lib/db/client", () => ({
  db,
}));

vi.mock("@/lib/role-assignments", () => ({
  getEffectiveRoleAssignmentsForUser: getEffectiveRoleAssignmentsForUserMock,
}));

vi.mock("@/lib/db/schema", () => ({
  users: {
    id: "users.id",
    email: "users.email",
    displayName: "users.displayName",
    isActive: "users.isActive",
    lastLoginAt: "users.lastLoginAt",
    createdAt: "users.createdAt",
  },
  roles: {
    id: "roles.id",
    slug: "roles.slug",
  },
  userRoles: {
    userId: "user_roles.userId",
  },
  tenantSubscription: {
    tierId: "tenant_subscription.tierId",
    tenantId: "tenant_subscription.tenantId",
    expiresAt: "tenant_subscription.expiresAt",
  },
  subscriptionTiers: {
    id: "subscription_tiers.id",
    slug: "subscription_tiers.slug",
    displayName: "subscription_tiers.displayName",
    level: "subscription_tiers.level",
  },
  tenants: {
    id: "tenants.id",
    isPlatform: "tenants.isPlatform",
  },
}));

vi.mock("drizzle-orm", () => ({
  asc: vi.fn((value) => value),
  desc: vi.fn((value) => value),
  eq: vi.fn(),
  inArray: vi.fn(),
  sql: Object.assign(vi.fn(() => "sql"), {
    raw: vi.fn(),
  }),
}));

describe("settings users routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRolesMock.mockResolvedValue(null);
    authMock.mockResolvedValue({
      user: {
        tenantSlug: "acme",
        tenantId: "tenant-1",
      },
    });

    tenantDb.select.mockReturnValue(tenantDb);
    tenantDb.from.mockReturnValue(tenantDb);
    tenantDb.orderBy.mockReturnValue(tenantDb);
    tenantDb.limit.mockReturnValue(tenantDb);
    tenantDb.offset.mockResolvedValue([
      {
        id: "user-1",
        email: "user@example.com",
        displayName: "User",
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
      },
    ]);
    tenantDb.where.mockResolvedValue([{ count: 1 }]);
    tenantDb.delete.mockReturnValue(tenantDb);
    tenantDb.update.mockReturnValue(tenantDb);
    tenantDb.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    db.select.mockReturnValue(db);
    db.from.mockReturnValue(db);
    db.innerJoin.mockReturnValue(db);
    db.where.mockReturnValue(db);
    db.limit.mockResolvedValue([
      {
        tierId: "tier-1",
        slug: "standard",
        displayName: "Standard",
        level: 1,
        expiresAt: null,
      },
    ]);

    getEffectiveRoleAssignmentsForUserMock.mockResolvedValue({
      manualRoles: [{ slug: "admin", displayName: "Admin" }],
      idpRoles: [{ slug: "user", displayName: "User" }],
      effectiveRoles: [
        { slug: "admin", displayName: "Admin" },
        { slug: "user", displayName: "User" },
      ],
    });
  });

  it("returns manual, idp, and effective roles separately from GET /api/settings/users", async () => {
    const { GET } = await import("@/app/api/settings/users/route");
    const response = await GET(new NextRequest("http://localhost/api/settings/users"));
    const body = await response.json() as {
      users: Array<{
        manualRoles: Array<{ slug: string }>;
        idpRoles: Array<{ slug: string }>;
        effectiveRoles: Array<{ slug: string }>;
      }>;
    };

    expect(body.users[0]).toMatchObject({
      manualRoles: [{ slug: "admin" }],
      idpRoles: [{ slug: "user" }],
      effectiveRoles: [{ slug: "admin" }, { slug: "user" }],
    });
  });

  it("preserves the platform lockout when deactivating the last active platform user", async () => {
    const { PATCH } = await import("@/app/api/settings/users/[userId]/route");
    const request = new NextRequest("http://localhost/api/settings/users/user-1", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
      headers: { "Content-Type": "application/json" },
    });

    db.limit.mockResolvedValueOnce([{ isPlatform: true }]);
    tenantDb.where.mockResolvedValueOnce([{ count: 1 }]);

    const response = await PATCH(request, {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Cannot deactivate the last user on a platform tenant",
    });
  });
});
