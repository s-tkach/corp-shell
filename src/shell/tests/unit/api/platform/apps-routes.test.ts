import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, isPlatformAdminMock, dbMock, eqMock, ascMock } = vi.hoisted(() => {
  const db = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };

  return {
    authMock: vi.fn(),
    isPlatformAdminMock: vi.fn(),
    dbMock: db,
    eqMock: vi.fn(),
    ascMock: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/platform-guard", () => ({ isPlatformAdmin: isPlatformAdminMock }));
vi.mock("@/lib/db/client", () => ({ db: dbMock }));
vi.mock("@/lib/db/schema", () => ({
  appRegistry: {
    id: "app_registry.id",
    name: "app_registry.name",
    lastHealthyAt: "app_registry.lastHealthyAt",
  },
}));
vi.mock("drizzle-orm", () => ({ eq: eqMock, asc: ascMock }));

describe("platform app registry routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { roles: ["super_admin"], tenantSlug: "platform" } });
    isPlatformAdminMock.mockReturnValue(true);
    dbMock.select.mockReturnValue(dbMock);
    dbMock.from.mockReturnValue(dbMock);
    dbMock.where.mockReturnValue(dbMock);
    dbMock.limit.mockResolvedValue([]);
    dbMock.insert.mockReturnValue(dbMock);
    dbMock.values.mockReturnValue(dbMock);
    dbMock.returning.mockResolvedValue([{ id: "app-1" }]);
    dbMock.update.mockReturnValue(dbMock);
    dbMock.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  it("rejects private remoteUrl values on create", async () => {
    const { POST } = await import("@/app/api/platform/apps/route");
    const request = new NextRequest("http://localhost/api/platform/apps", {
      method: "POST",
      body: JSON.stringify({
        name: "Inventory",
        remoteUrl: "https://10.0.0.5",
        routePrefix: "/inventory",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("remoteUrl must be a valid public HTTPS URL");
    expect(body.error).not.toContain("10.0.0.5");
  });

  it("rejects private healthCheckUrl values on update", async () => {
    const { PATCH } = await import("@/app/api/platform/apps/[appId]/route");
    const request = new NextRequest("http://localhost/api/platform/apps/app-1", {
      method: "PATCH",
      body: JSON.stringify({ healthCheckUrl: "https://169.254.1.1/health" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, { params: Promise.resolve({ appId: "app-1" }) });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("healthCheckUrl must be a valid public HTTPS URL");
  });

  it("sanitizes manifest validation failures", async () => {
    dbMock.limit.mockResolvedValue([{ remoteUrl: "https://inventory.example.com" }]);
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED inventory.example.com"));

    const { POST } = await import("@/app/api/platform/apps/[appId]/validate/route");
    const response = await POST(new NextRequest("http://localhost/api/platform/apps/app-1/validate", { method: "POST" }), {
      params: Promise.resolve({ appId: "app-1" }),
    });
    const body = await response.json() as { valid: boolean; error: string };

    expect(body).toEqual({
      valid: false,
      error: "Manifest fetch failed",
    });
    expect(body.error).not.toContain("inventory.example.com");
  });

  it("sanitizes health check failures", async () => {
    dbMock.limit.mockResolvedValue([{ id: "app-1", healthCheckUrl: "https://inventory.example.com/health" }]);
    global.fetch = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT inventory.example.com"));

    const { POST } = await import("@/app/api/platform/apps/[appId]/health/route");
    const response = await POST(new NextRequest("http://localhost/api/platform/apps/app-1/health", { method: "POST" }), {
      params: Promise.resolve({ appId: "app-1" }),
    });
    const body = await response.json() as { healthy: boolean; error: string };

    expect(body).toEqual({
      healthy: false,
      error: "Health check failed",
    });
    expect(body.error).not.toContain("inventory.example.com");
  });
});
