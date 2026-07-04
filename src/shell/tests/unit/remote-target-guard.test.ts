import { beforeEach, describe, expect, it, vi } from "vitest";

describe("remote target guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("accepts public https URLs and normalizes them", async () => {
    const { validateRemoteUrl } = await import("@/lib/remote-target-guard");

    expect(validateRemoteUrl("https://okta.example.com/oidc/")).toMatchObject({
      ok: true,
      normalized: "https://okta.example.com/oidc",
    });
  });

  it("rejects insecure or private targets with sanitized errors", async () => {
    const { validateRemoteUrl } = await import("@/lib/remote-target-guard");

    expect(validateRemoteUrl("http://okta.example.com")).toMatchObject({
      ok: false,
      kind: "https_required",
      error: "Remote target must use HTTPS",
    });

    expect(validateRemoteUrl("https://127.0.0.1/oidc")).toMatchObject({
      ok: false,
      kind: "private_target",
      error: "Remote target must be publicly reachable",
    });

    expect(validateRemoteUrl("https://169.254.169.254/latest/meta-data")).toMatchObject({
      ok: false,
      kind: "private_target",
      error: "Remote target must be publicly reachable",
    });
  });

  it("uses the shared timeout for OIDC discovery fetches", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        issuer: "https://okta.example.com",
        authorization_endpoint: "https://okta.example.com/oauth2/v1/authorize",
      }),
    } as Response);

    const { fetchOidcDiscovery, REMOTE_VALIDATION_TIMEOUT_MS } = await import("@/lib/remote-target-guard");
    await fetchOidcDiscovery("https://okta.example.com");

    expect(timeoutSpy).toHaveBeenCalledWith(REMOTE_VALIDATION_TIMEOUT_MS);
  });

  it("sanitizes remote fetch failures without leaking hostnames", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED okta.example.com"));

    const { fetchOidcDiscovery } = await import("@/lib/remote-target-guard");
    const result = await fetchOidcDiscovery("https://okta.example.com");

    expect(result).toMatchObject({
      ok: false,
      kind: "fetch_failed",
      error: "OIDC discovery failed",
    });
    if (result.ok) {
      throw new Error("expected OIDC discovery to fail");
    }
    expect(result.error).not.toContain("okta.example.com");
  });
});
