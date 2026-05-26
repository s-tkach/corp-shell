import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireRoles = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/auth-guard", () => ({ requireRoles: mockRequireRoles }));

const mockAuth = vi.fn().mockResolvedValue({ user: { tenantSlug: "acme" } });
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockEncrypt = vi.fn((s: string) => Promise.resolve(`enc:${s}`));
vi.mock("@/lib/crypto", () => ({ encrypt: mockEncrypt }));

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([
    { id: "p1", displayName: "Okta", issuer: "https://okta.example.com", clientId: "cid", isEnabled: true, scopes: ["openid"], groupClaimName: "groups", createdAt: new Date() },
  ]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
};

vi.mock("@/lib/db/tenant", () => ({ withTenant: vi.fn(() => mockDb) }));
vi.mock("@/lib/db/schema", () => ({
  idpProviders: { id: "id", displayName: "displayName", issuer: "issuer", clientId: "clientId", scopes: "scopes", groupClaimName: "groupClaimName", isEnabled: "isEnabled", createdAt: "createdAt", encryptedClientSecret: "encryptedClientSecret" },
}));
vi.mock("drizzle-orm", () => ({ asc: vi.fn((col) => col), eq: vi.fn() }));

describe("GET /api/admin/sso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRoles.mockResolvedValue(null);
    mockAuth.mockResolvedValue({ user: { tenantSlug: "acme" } });
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.orderBy.mockResolvedValue([
      { id: "p1", displayName: "Okta", issuer: "https://okta.example.com", clientId: "cid", isEnabled: true, scopes: ["openid"], groupClaimName: "groups", createdAt: new Date() },
    ]);
  });

  it("returns list of providers without secrets", async () => {
    const { GET } = await import("@/app/api/admin/sso/route");
    const res = await GET();
    const data = await res.json() as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect((data[0] as Record<string, unknown>)["displayName"]).toBe("Okta");
    expect((data[0] as Record<string, unknown>)["encryptedClientSecret"]).toBeUndefined();
  });

  it("returns 401 when auth guard rejects", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireRoles.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const { GET } = await import("@/app/api/admin/sso/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/sso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRoles.mockResolvedValue(null);
    mockAuth.mockResolvedValue({ user: { tenantSlug: "acme" } });
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([{ id: "new-id" }]);
  });

  it("returns 400 when OIDC discovery fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    const { POST } = await import("@/app/api/admin/sso/route");
    const req = new NextRequest("http://localhost/api/admin/sso", {
      method: "POST",
      body: JSON.stringify({ slug: "okta", displayName: "Okta", issuer: "https://bad.example.com", clientId: "cid", clientSecret: "sec" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error?: string };
    expect(data.error).toMatch(/OIDC discovery failed/);
  });

  it("encrypts client secret and returns 201 on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const { POST } = await import("@/app/api/admin/sso/route");
    const req = new NextRequest("http://localhost/api/admin/sso", {
      method: "POST",
      body: JSON.stringify({ slug: "okta", displayName: "Okta", issuer: "https://okta.example.com", clientId: "cid", clientSecret: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockEncrypt).toHaveBeenCalledWith("secret");
    const data = await res.json() as { id?: string };
    expect(data.id).toBe("new-id");
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/admin/sso/route");
    const req = new NextRequest("http://localhost/api/admin/sso", {
      method: "POST",
      body: JSON.stringify({ displayName: "Okta" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
