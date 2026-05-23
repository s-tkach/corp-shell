import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module cache between tests so provider is re-created with fresh env
beforeEach(() => {
  vi.resetModules();
});

async function loadCrypto(env: Record<string, string>) {
  Object.assign(process.env, env);
  const mod = await import("@/lib/crypto");
  return mod;
}

describe("LocalCryptoProvider", () => {
  const KEY = "a".repeat(64); // 64 hex chars = 32 bytes

  it("round-trips plaintext", async () => {
    const { encrypt, decrypt } = await loadCrypto({
      ENCRYPTION_PROVIDER: "local",
      ENCRYPTION_KEY: KEY,
    });
    const plaintext = "super-secret-oidc-client-secret";
    const ciphertext = await encrypt(plaintext);
    expect(await decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (IV randomness)", async () => {
    const { encrypt } = await loadCrypto({
      ENCRYPTION_PROVIDER: "local",
      ENCRYPTION_KEY: KEY,
    });
    const a = await encrypt("hello");
    const b = await encrypt("hello");
    expect(a).not.toBe(b);
  });

  it("ciphertext starts with 'local:'", async () => {
    const { encrypt } = await loadCrypto({
      ENCRYPTION_PROVIDER: "local",
      ENCRYPTION_KEY: KEY,
    });
    const ct = await encrypt("test");
    expect(ct.startsWith("local:")).toBe(true);
  });

  it("throws on tampered ciphertext (GCM auth tag failure)", async () => {
    const { encrypt, decrypt } = await loadCrypto({
      ENCRYPTION_PROVIDER: "local",
      ENCRYPTION_KEY: KEY,
    });
    const ct = await encrypt("secret");
    // Flip the last hex char of the auth tag
    const tampered = ct.slice(0, -1) + (ct.endsWith("0") ? "1" : "0");
    await expect(decrypt(tampered)).rejects.toThrow();
  });
});

describe("Provider selection", () => {
  it("selects local provider when ENCRYPTION_PROVIDER=local", async () => {
    const { encrypt } = await loadCrypto({
      ENCRYPTION_PROVIDER: "local",
      ENCRYPTION_KEY: "b".repeat(64),
    });
    const ct = await encrypt("x");
    expect(ct.startsWith("local:")).toBe(true);
  });

  it("selects KMS provider when ENCRYPTION_PROVIDER=kms (mock KMS)", async () => {
    vi.doMock("@/lib/kms", () => ({
      kmsEncrypt: async (pt: string) => `kms:${pt}`,
      kmsDecrypt: async (ct: string) => ct.replace("kms:", ""),
    }));

    process.env["ENCRYPTION_PROVIDER"] = "kms";
    delete process.env["ENCRYPTION_KEY"];
    process.env["KMS_KEY_ID"] = "alias/test-key";

    const { encrypt, decrypt } = await import("@/lib/crypto");
    const ct = await encrypt("hello");
    expect(ct).toBe("kms:hello");
    expect(await decrypt(ct)).toBe("hello");
  });
});
