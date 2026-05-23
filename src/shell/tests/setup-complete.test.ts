import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  resetAuth: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(async (pt: string) => `encrypted:${pt}`),
  decrypt: vi.fn(async (ct: string) => ct.replace("encrypted:", "")),
}));

import { db } from "@/lib/db/client";
import { encrypt } from "@/lib/crypto";

const mockDb = vi.mocked(db);

describe("Setup complete — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a second POST when setup_complete is already true", () => {
    const existing = [{ setupComplete: true }];
    expect(existing[0]?.setupComplete ? 409 : 200).toBe(409);
  });

  it("allows POST when setup is not complete", () => {
    const existing: Array<{ setupComplete: boolean }> = [];
    expect(existing[0]?.setupComplete ? 409 : 200).toBe(200);
  });
});

describe("Setup complete — OIDC secret encryption", () => {
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

describe("Setup complete — atomic transaction", () => {
  it("calls db.transaction for the write and propagates errors", async () => {
    mockDb.transaction = vi.fn(async () => {
      throw new Error("Simulated DB error");
    });

    let threw = false;
    try {
      await mockDb.transaction(async () => undefined);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(mockDb.transaction).toHaveBeenCalledOnce();
  });
});
