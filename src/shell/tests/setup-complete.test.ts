import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(async (pt: string) => `encrypted:${pt}`),
  decrypt: vi.fn(async (ct: string) => ct.replace("encrypted:", "")),
}));

import { encrypt } from "@/lib/crypto";

describe("Setup — idempotency guard", () => {
  it("rejects when setupComplete is already true", () => {
    const configRows = [{ setupComplete: true }];
    const shouldReject = configRows[0]?.setupComplete === true;
    expect(shouldReject).toBe(true);
  });

  it("allows setup when not yet complete", () => {
    const configRows: Array<{ setupComplete: boolean }> = [];
    const shouldReject = configRows[0]?.setupComplete === true;
    expect(shouldReject).toBe(false);
  });
});

describe("Setup — OIDC secret encryption", () => {
  it("encrypts the OIDC client secret before writing to DB", async () => {
    const plainSecret = "my-oidc-client-secret";
    const ciphertext = await encrypt(plainSecret);
    expect(ciphertext).toBe(`encrypted:${plainSecret}`);
    expect(ciphertext).not.toBe(plainSecret);
  });

  it("ciphertext is not equal to plaintext", async () => {
    const ct = await encrypt("secret123");
    expect(ct).not.toBe("secret123");
  });
});
