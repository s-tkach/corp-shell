import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn();

describe("GET /api/setup/validate-oidc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when issuer param is missing", async () => {
    const { GET } = await import("@/app/api/setup/validate-oidc/route");
    const req = new Request("http://localhost/api/setup/validate-oidc");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/issuer/i);
  });

  it("returns 400 when issuer is not https", async () => {
    const { GET } = await import("@/app/api/setup/validate-oidc/route");
    const req = new Request("http://localhost/api/setup/validate-oidc?issuer=http://insecure.com");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/https/i);
  });

  it("returns ok:true when discovery succeeds", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ issuer: "https://example.com", authorization_endpoint: "https://example.com/auth" }), { status: 200 })
    );
    const { GET } = await import("@/app/api/setup/validate-oidc/route");
    const req = new Request("http://localhost/api/setup/validate-oidc?issuer=https://example.com");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 400 when discovery fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));
    const { GET } = await import("@/app/api/setup/validate-oidc/route");
    const req = new Request("http://localhost/api/setup/validate-oidc?issuer=https://unreachable.example.com");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
