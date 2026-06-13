import { describe, expect, it } from "vitest";

import {
  getDevFreshCryptoPreflightError,
  parseDevFreshEnv,
  resolveDevFreshCryptoProvider,
} from "@/scripts/dev-fresh-crypto";

const KEY = "a".repeat(64);

describe("resolveDevFreshCryptoProvider", () => {
  it("returns kms for an explicit kms provider", () => {
    expect(
      resolveDevFreshCryptoProvider({
        ENCRYPTION_PROVIDER: "kms",
        ENCRYPTION_KEY: KEY,
        KMS_KEY_ID: "alias/test-key",
      })
    ).toBe("kms");
  });

  it("returns local for an explicit local provider", () => {
    expect(
      resolveDevFreshCryptoProvider({
        ENCRYPTION_PROVIDER: "local",
        ENCRYPTION_KEY: KEY,
        KMS_KEY_ID: "alias/test-key",
      })
    ).toBe("local");
  });

  it("returns null for an invalid explicit provider", () => {
    expect(
      resolveDevFreshCryptoProvider({
        ENCRYPTION_PROVIDER: "bogus",
        ENCRYPTION_KEY: KEY,
        KMS_KEY_ID: "alias/test-key",
      })
    ).toBeNull();
  });

  it("returns kms when the provider is unset and KMS_KEY_ID is present", () => {
    expect(
      resolveDevFreshCryptoProvider({
        KMS_KEY_ID: "alias/test-key",
      })
    ).toBe("kms");
  });

  it("prefers kms when the provider is unset and both KMS_KEY_ID and ENCRYPTION_KEY are present", () => {
    expect(
      resolveDevFreshCryptoProvider({
        KMS_KEY_ID: "alias/test-key",
        ENCRYPTION_KEY: KEY,
      })
    ).toBe("kms");
  });

  it("returns local when the provider is unset and ENCRYPTION_KEY is present", () => {
    expect(
      resolveDevFreshCryptoProvider({
        ENCRYPTION_KEY: KEY,
      })
    ).toBe("local");
  });

  it("returns null when no supported provider config is present", () => {
    expect(resolveDevFreshCryptoProvider({})).toBeNull();
  });
});

describe("getDevFreshCryptoPreflightError", () => {
  it("returns null for a valid local config", () => {
    expect(
      getDevFreshCryptoPreflightError({
        ENCRYPTION_PROVIDER: "local",
        ENCRYPTION_KEY: KEY,
      })
    ).toBeNull();
  });

  it("rejects local keys that are not exactly 64 hex characters", () => {
    expect(
      getDevFreshCryptoPreflightError({
        ENCRYPTION_PROVIDER: "local",
        ENCRYPTION_KEY: "short",
      })
    ).toContain("ENCRYPTION_KEY must be 64 hex characters");

    expect(
      getDevFreshCryptoPreflightError({
        ENCRYPTION_PROVIDER: "local",
        ENCRYPTION_KEY: "g".repeat(64),
      })
    ).toContain("ENCRYPTION_KEY must be 64 hex characters");
  });

  it("returns a dev:fresh-specific error when config resolves to kms", () => {
    const error = getDevFreshCryptoPreflightError({
      ENCRYPTION_PROVIDER: "kms",
      KMS_KEY_ID: "alias/test-key",
    });

    expect(error).toContain("dev:fresh does not support KMS-backed local setup");
    expect(error).toContain("/api/setup would use AWS KMS");
    expect(error).toContain(
      "ENCRYPTION_PROVIDER=local with a valid ENCRYPTION_KEY"
    );
  });

  it("follows the kms preflight path when the provider is unset and both KMS_KEY_ID and ENCRYPTION_KEY are present", () => {
    const error = getDevFreshCryptoPreflightError({
      KMS_KEY_ID: "alias/test-key",
      ENCRYPTION_KEY: KEY,
    });

    expect(error).toContain("dev:fresh does not support KMS-backed local setup");
    expect(error).toContain("/api/setup would use AWS KMS");
  });

  it("returns a targeted error when local crypto config is missing", () => {
    expect(getDevFreshCryptoPreflightError({})).toContain(
      "Set ENCRYPTION_PROVIDER=local and provide ENCRYPTION_KEY"
    );
  });

  it("rejects an invalid explicit provider value", () => {
    expect(
      getDevFreshCryptoPreflightError({
        ENCRYPTION_PROVIDER: "bogus",
        ENCRYPTION_KEY: KEY,
        KMS_KEY_ID: "alias/test-key",
      })
    ).toContain("ENCRYPTION_PROVIDER must be 'kms' or 'local'");
  });
});

describe("parseDevFreshEnv", () => {
  it("strips matching quotes from dotenv-style values before preflight", () => {
    const env = parseDevFreshEnv(
      `ENCRYPTION_PROVIDER="local"\nENCRYPTION_KEY="${KEY}"\n`
    );

    expect(env).toEqual({
      ENCRYPTION_PROVIDER: "local",
      ENCRYPTION_KEY: KEY,
    });
    expect(getDevFreshCryptoPreflightError(env)).toBeNull();
  });
});
