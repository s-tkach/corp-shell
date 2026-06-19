import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const accessSnapshotMock = vi.fn();
const getMenuTreeForTenantMock = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/request-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/request-access")>();
  return {
    ...actual,
    getRequestAccessSnapshot: accessSnapshotMock,
  };
});

vi.mock("@/lib/menu", () => ({
  getMenuTreeForTenant: getMenuTreeForTenantMock,
}));

describe("GET /api/menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the fresh request-time snapshot rejects the session", async () => {
    authMock.mockResolvedValue({
      user: { tenantSlug: "acme", userId: "user-1" },
    });
    accessSnapshotMock.mockResolvedValue({
      outcome: "login",
      userRoles: [],
      subscriptionLevel: 0,
      subscriptionTier: "free",
      isPlatformAdmin: false,
    });

    const { GET } = await import("@/app/api/menu/route");
    const response = await GET();

    expect(response).toMatchObject({ status: 401 });
  });

  it("uses fresh roles and subscription state instead of stale session claims", async () => {
    authMock.mockResolvedValue({
      user: {
        tenantSlug: "acme",
        userId: "user-1",
        roles: ["admin"],
        subscriptionLevel: 2,
      },
    });
    accessSnapshotMock.mockResolvedValue({
      outcome: "allow",
      userRoles: ["user"],
      subscriptionLevel: 1,
      subscriptionTier: "standard",
      isPlatformAdmin: false,
    });
    getMenuTreeForTenantMock.mockResolvedValue([{ id: "main", items: [] }]);

    const { GET } = await import("@/app/api/menu/route");
    const response = await GET();

    expect(getMenuTreeForTenantMock).toHaveBeenCalledWith({
      tenantSlug: "acme",
      subscriptionLevel: 1,
      userRoles: ["user"],
      isPlatformAdmin: false,
    });
    expect(response).toMatchObject({ status: 200 });
  });
});
