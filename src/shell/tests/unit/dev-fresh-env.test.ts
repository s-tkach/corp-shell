import { describe, expect, it } from "vitest";

import {
  getDevFreshPlatformOidcEnv,
  updateDevFreshEnvValue,
} from "@/scripts/dev-fresh-env";

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

describe("updateDevFreshEnvValue", () => {
  it("rotates the local cookie namespace without changing the auth secret", () => {
    expect(
      updateDevFreshEnvValue(
        "NEXTAUTH_SECRET=stable-secret\nAUTH_COOKIE_NAMESPACE=previous\n",
        "AUTH_COOKIE_NAMESPACE",
        "fresh-a"
      )
    ).toBe("NEXTAUTH_SECRET=stable-secret\nAUTH_COOKIE_NAMESPACE=fresh-a\n");
  });

  it("replaces every prior namespace assignment so dotenv uses the fresh value", () => {
    expect(
      updateDevFreshEnvValue(
        "AUTH_COOKIE_NAMESPACE=first\nNEXTAUTH_SECRET=stable-secret\nAUTH_COOKIE_NAMESPACE=last\n",
        "AUTH_COOKIE_NAMESPACE",
        "fresh-a"
      )
    ).toBe(
      "AUTH_COOKIE_NAMESPACE=fresh-a\nNEXTAUTH_SECRET=stable-secret\nAUTH_COOKIE_NAMESPACE=fresh-a\n"
    );
  });
});
