import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const handlerGet = vi.fn();
const handlerPost = vi.fn();
const getPkceCodeVerifierCookieName = vi.fn();

vi.mock("@/lib/auth", () => ({
  handlers: { GET: handlerGet, POST: handlerPost },
}));

vi.mock("@/lib/auth-cookies", () => ({
  getPkceCodeVerifierCookieName,
}));

describe("Auth.js callback route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    handlerGet.mockResolvedValue(new Response(null, { status: 204 }));
    handlerPost.mockResolvedValue(new Response(null, { status: 204 }));
    getPkceCodeVerifierCookieName.mockReturnValue("authjs.fresh-a.pkce.code_verifier");
  });

  it("redirects a POST callback without the current PKCE cookie to login", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/auth/callback/okta", {
        method: "POST",
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirects an OIDC callback without the current PKCE cookie to login", async () => {
    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/auth/callback/okta?code=stale-code")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("passes an OIDC callback with the current PKCE cookie to Auth.js", async () => {
    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/auth/callback/okta?code=current-code", {
        headers: { cookie: "authjs.fresh-a.pkce.code_verifier=current-verifier" },
      })
    );

    expect(response.status).toBe(204);
  });
});
