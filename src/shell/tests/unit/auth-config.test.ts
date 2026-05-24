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
          displayName: "Okta",
          issuer: "https://accounts.google.com",
          clientId: "my-client-id",
          encryptedClientSecret: "encrypted-secret",
          scopes: ["openid", "email"],
        },
      ]),
    };
    mockWithTenant.mockReturnValue(mockDb);

    const { getAuthConfig } = await import("@/lib/auth-config");
    const config = await getAuthConfig("acme");

    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toMatchObject({
      id: "provider-1",
      issuer: "https://accounts.google.com",
      clientId: "my-client-id",
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
});
