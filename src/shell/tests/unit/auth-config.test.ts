import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDecrypt = vi.fn((ct: string) => Promise.resolve(`decrypted-${ct}`));
vi.mock("@/lib/crypto", () => ({ decrypt: mockDecrypt }));

const mockWithTenant = vi.fn();
vi.mock("@/lib/db/tenant", () => ({ withTenant: mockWithTenant }));

describe("getAuthConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns providers array with one entry per enabled IDP", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: "provider-1",
          slug: "okta",
          displayName: "Okta",
          issuer: "https://accounts.google.com",
          clientId: "my-client-id",
          encryptedClientSecret: "encrypted-secret",
          scopes: ["openid", "email"],
          tokenEndpointAuthMethod: "client_secret_post",
        },
      ]),
    };
    mockWithTenant.mockReturnValue(mockDb);

    const { getAuthConfig } = await import("@/lib/auth-config");
    const config = await getAuthConfig("acme");

    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toMatchObject({
      id: "okta",
      issuer: "https://accounts.google.com",
      clientId: "my-client-id",
      client: { token_endpoint_auth_method: "client_secret_post" },
    });
    expect(mockDecrypt).toHaveBeenCalledWith("encrypted-secret");
  });

  it("returns empty providers array if no enabled IDPs", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockWithTenant.mockReturnValue(mockDb);

    const { getAuthConfig } = await import("@/lib/auth-config");
    const config = await getAuthConfig("acme");

    expect(config.providers).toHaveLength(0);
  });

  it("builds the platform provider from PLATFORM_OIDC_* env vars without tenant DB reads", async () => {
    mockWithTenant.mockImplementation(() => {
      throw new Error("tenant DB should not be used for platform provider");
    });

    const originalEnv = {
      PLATFORM_OIDC_ISSUER: process.env["PLATFORM_OIDC_ISSUER"],
      PLATFORM_OIDC_CLIENT_ID: process.env["PLATFORM_OIDC_CLIENT_ID"],
      PLATFORM_OIDC_CLIENT_SECRET: process.env["PLATFORM_OIDC_CLIENT_SECRET"],
    };

    process.env["PLATFORM_OIDC_ISSUER"] = "https://platform.example.com";
    process.env["PLATFORM_OIDC_CLIENT_ID"] = "platform-client";
    process.env["PLATFORM_OIDC_CLIENT_SECRET"] = "platform-secret";

    const { getAuthConfig } = await import("@/lib/auth-config");
    const config = await getAuthConfig("platform");

    expect(config.providers).toEqual([
      {
        id: "oidc",
        name: "Platform SSO",
        type: "oidc",
        issuer: "https://platform.example.com",
        clientId: "platform-client",
        clientSecret: "platform-secret",
        client: { token_endpoint_auth_method: "client_secret_post" },
        authorization: { params: { scope: "openid profile email" } },
      },
    ]);
    expect(mockDecrypt).not.toHaveBeenCalled();

    process.env["PLATFORM_OIDC_ISSUER"] = originalEnv.PLATFORM_OIDC_ISSUER;
    process.env["PLATFORM_OIDC_CLIENT_ID"] = originalEnv.PLATFORM_OIDC_CLIENT_ID;
    process.env["PLATFORM_OIDC_CLIENT_SECRET"] = originalEnv.PLATFORM_OIDC_CLIENT_SECRET;
  });
});
