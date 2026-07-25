import { describe, expect, it } from "vitest";

import { getAuthCookies } from "@/lib/auth-cookies";

describe("getAuthCookies", () => {
  it("uses Auth.js defaults when no fresh-environment namespace is configured", () => {
    expect(getAuthCookies()).toBeUndefined();
  });

  it("isolates every Auth.js cookie in a fresh local environment", () => {
    expect(getAuthCookies("fresh-a")).toEqual({
      sessionToken: { name: "authjs.fresh-a.session-token" },
      callbackUrl: { name: "authjs.fresh-a.callback-url" },
      csrfToken: { name: "authjs.fresh-a.csrf-token" },
      pkceCodeVerifier: { name: "authjs.fresh-a.pkce.code_verifier" },
      state: { name: "authjs.fresh-a.state" },
      nonce: { name: "authjs.fresh-a.nonce" },
      webauthnChallenge: { name: "authjs.fresh-a.challenge" },
    });
  });
});
