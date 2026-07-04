import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireRolesMock = vi.fn();
const authMock = vi.fn();
const encryptMock = vi.fn(async (value: string) => `enc:${value}`);

const tenantDb = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const db = {
  select: vi.fn(),
  from: vi.fn(),
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

vi.mock("@/lib/crypto", () => ({
  encrypt: encryptMock,
}));

vi.mock("@/lib/db/schema", () => ({
  idpProviders: {
    id: "idp_providers.id",
    isEnabled: "idp_providers.isEnabled",
    displayName: "idp_providers.displayName",
    issuer: "idp_providers.issuer",
    clientId: "idp_providers.clientId",
    encryptedClientSecret: "idp_providers.encryptedClientSecret",
    scopes: "idp_providers.scopes",
    groupClaimName: "idp_providers.groupClaimName",
  },
  tenants: {
    id: "tenants.id",
    isPlatform: "tenants.isPlatform",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(() => "sql"),
}));

describe("settings sso provider route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRolesMock.mockResolvedValue(null);
    authMock.mockResolvedValue({
      user: {
        tenantSlug: "platform",
        tenantId: "tenant-platform",
      },
    });

    tenantDb.select.mockReturnValue(tenantDb);
    tenantDb.from.mockReturnValue(tenantDb);
    tenantDb.where.mockResolvedValue([{ count: 1 }]);
    tenantDb.update.mockReturnValue(tenantDb);
    tenantDb.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    tenantDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    db.select.mockReturnValue(db);
    db.from.mockReturnValue(db);
    db.where.mockReturnValue(db);
    db.limit.mockResolvedValue([{ isPlatform: true }]);
  });

  it("blocks disabling the last enabled SSO provider on a platform tenant", async () => {
    const { PATCH } = await import("@/app/api/settings/sso/[providerId]/route");
    const request = new NextRequest("http://localhost/api/settings/sso/provider-1", {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: false }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ providerId: "provider-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Cannot disable the last SSO provider on a platform tenant",
    });
  });

  it("blocks deleting the last SSO provider on a platform tenant", async () => {
    const { DELETE } = await import("@/app/api/settings/sso/[providerId]/route");
    const request = new NextRequest("http://localhost/api/settings/sso/provider-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ providerId: "provider-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Cannot remove the last SSO provider on a platform tenant",
    });
  });

  it("sanitizes issuer validation failures on update", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT internal.example.com"));
    tenantDb.where.mockResolvedValue([{ count: 2 }]);

    const { PATCH } = await import("@/app/api/settings/sso/[providerId]/route");
    const request = new NextRequest("http://localhost/api/settings/sso/provider-1", {
      method: "PATCH",
      body: JSON.stringify({ issuer: "https://internal.example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ providerId: "provider-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "OIDC discovery failed",
    });
  });
});
