import { describe, expect, it } from "vitest";

import { getDevFreshPlatformOidcEnv } from "@/scripts/dev-fresh-env";

describe("getDevFreshPlatformOidcEnv", () => {
  it("passes through PLATFORM_OIDC_* values when they are provided", () => {
    expect(
      getDevFreshPlatformOidcEnv({
        PLATFORM_OIDC_ISSUER: "https://platform.example.com",
        PLATFORM_OIDC_CLIENT_ID: "platform-client",
        PLATFORM_OIDC_CLIENT_SECRET: "platform-secret",
      })
    ).toEqual({
      PLATFORM_OIDC_ISSUER: "https://platform.example.com",
      PLATFORM_OIDC_CLIENT_ID: "platform-client",
      PLATFORM_OIDC_CLIENT_SECRET: "platform-secret",
    });
  });

  it("maps legacy SETUP_* values into PLATFORM_OIDC_* for dev:fresh", () => {
    expect(
      getDevFreshPlatformOidcEnv({
        SETUP_ISSUER: "https://legacy.example.com",
        SETUP_CLIENT_ID: "legacy-client",
        SETUP_CLIENT_SECRET: "legacy-secret",
      })
    ).toEqual({
      PLATFORM_OIDC_ISSUER: "https://legacy.example.com",
      PLATFORM_OIDC_CLIENT_ID: "legacy-client",
      PLATFORM_OIDC_CLIENT_SECRET: "legacy-secret",
    });
  });

  it("returns null when neither PLATFORM_OIDC_* nor SETUP_* is complete", () => {
    expect(
      getDevFreshPlatformOidcEnv({
        SETUP_ISSUER: "https://legacy.example.com",
        SETUP_CLIENT_ID: "legacy-client",
      })
    ).toBeNull();
  });
});
