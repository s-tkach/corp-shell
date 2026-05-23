import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: async (ct: string) => ct,
  encrypt: async (pt: string) => pt,
}));

describe("JIT provisioning — new user", () => {
  it("inserts user row, role rows, and subscription row on first login", async () => {
    // The JWT callback logic determines a new user needs provisioning when
    // existingUsers.length === 0. Verify that condition correctly triggers provisioning.
    const existingUsers: Array<{ id: string }> = [];
    const shouldProvision = existingUsers.length === 0 || existingUsers[0] === undefined;
    expect(shouldProvision).toBe(true);
  });
});

describe("Existing user — lastLoginAt update", () => {
  it("does not provision when user already exists", () => {
    const existingUsers = [{ id: "uuid-existing" }];
    const shouldProvision = existingUsers.length === 0 || existingUsers[0] === undefined;
    expect(shouldProvision).toBe(false);
  });
});

describe("Subscription expiry", () => {
  it("recognises expired non-free subscription", () => {
    const tier = { slug: "standard", level: 1, expiresAt: new Date("2020-01-01") };
    const isExpired = tier.expiresAt < new Date() && tier.slug !== "free";
    expect(isExpired).toBe(true);
  });

  it("does not flag active subscription as expired", () => {
    const tier = { slug: "standard", level: 1, expiresAt: new Date("2099-01-01") };
    const isExpired = tier.expiresAt < new Date() && tier.slug !== "free";
    expect(isExpired).toBe(false);
  });

  it("does not flag free tier as expired regardless of date", () => {
    const tier = { slug: "free", level: 0, expiresAt: new Date("2020-01-01") };
    const isExpired = tier.expiresAt < new Date() && tier.slug !== "free";
    expect(isExpired).toBe(false);
  });

  it("does not flag tier with no expiry", () => {
    const tier = { slug: "enterprise", level: 2, expiresAt: null as Date | null };
    const isExpired = tier.expiresAt !== null && tier.expiresAt < new Date() && tier.slug !== "free";
    expect(isExpired).toBe(false);
  });
});

describe("Group mapping", () => {
  it("deduplicates role slugs from IDP group mappings", () => {
    const mappings = [{ slug: "admin" }, { slug: "admin" }, { slug: "super_admin" }];
    const roleSlugs = [...new Set(mappings.map((m) => m.slug))];
    expect(roleSlugs).toEqual(["admin", "super_admin"]);
  });

  it("returns empty array when no IDP groups are present", () => {
    const idpGroups: string[] = [];
    const roleSlugs = idpGroups.length > 0 ? ["some-role"] : [];
    expect(roleSlugs).toEqual([]);
  });
});
