import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const accessSnapshotMock = vi.fn();

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

vi.mock("@/lib/request-access", () => ({
  getRequestAccessSnapshot: accessSnapshotMock,
}));

describe("requireRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the fresh request-time snapshot rejects the user as login-required", async () => {
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

    const { requireRoles } = await import("@/lib/auth-guard");
    const response = await requireRoles(["admin"]);

    expect(response).toMatchObject({ status: 401 });
  });

  it("uses fresh request-time roles instead of stale session roles", async () => {
    authMock.mockResolvedValue({
      user: { tenantSlug: "acme", userId: "user-1", roles: ["admin"] },
    });
    accessSnapshotMock.mockResolvedValue({
      outcome: "allow",
      userRoles: ["user"],
      subscriptionLevel: 1,
      subscriptionTier: "standard",
      isPlatformAdmin: false,
    });

    const { requireRoles } = await import("@/lib/auth-guard");
    const response = await requireRoles(["admin"]);

    expect(response).toMatchObject({ status: 403 });
  });

  it("allows the request when the fresh request-time roles satisfy the guard", async () => {
    authMock.mockResolvedValue({
      user: { tenantSlug: "acme", userId: "user-1", roles: ["user"] },
    });
    accessSnapshotMock.mockResolvedValue({
      outcome: "allow",
      userRoles: ["super_admin"],
      subscriptionLevel: 1,
      subscriptionTier: "standard",
      isPlatformAdmin: false,
    });

    const { requireRoles } = await import("@/lib/auth-guard");
    const response = await requireRoles(["super_admin"]);

    expect(response).toBeNull();
  });
});
