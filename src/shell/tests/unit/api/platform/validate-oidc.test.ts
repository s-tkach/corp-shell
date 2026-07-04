import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, isPlatformAdminMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  isPlatformAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/platform-guard", () => ({ isPlatformAdmin: isPlatformAdminMock }));

describe("GET /api/platform/validate-oidc", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { roles: ["super_admin"], tenantSlug: "platform" } });
    isPlatformAdminMock.mockReturnValue(true);
  });

  it("blocks private issuer targets without calling fetch", async () => {
    global.fetch = vi.fn();

    const { GET } = await import("@/app/api/platform/validate-oidc/route");
    const response = await GET(new Request("http://localhost/api/platform/validate-oidc?issuer=https://127.0.0.1/oidc"));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("issuer must be a valid public HTTPS URL");
    expect(body.error).not.toContain("127.0.0.1");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a sanitized error when discovery times out", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT okta.example.com"));

    const { GET } = await import("@/app/api/platform/validate-oidc/route");
    const response = await GET(new Request("http://localhost/api/platform/validate-oidc?issuer=https://okta.example.com"));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("OIDC discovery failed");
    expect(body.error).not.toContain("okta.example.com");
  });

  it("rejects invalid discovery document shapes", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issuer: "https://okta.example.com" }),
    } as Response);

    const { GET } = await import("@/app/api/platform/validate-oidc/route");
    const response = await GET(new Request("http://localhost/api/platform/validate-oidc?issuer=https://okta.example.com"));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("OIDC discovery document is invalid");
  });
});
