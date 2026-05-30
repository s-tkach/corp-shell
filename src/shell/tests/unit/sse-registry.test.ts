import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ connectionString: "postgres://test" }));
vi.mock("postgres", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const mockSql = vi.fn().mockResolvedValue([]) as any;
  mockSql.end = vi.fn().mockResolvedValue(undefined);
  mockSql.listen = vi.fn().mockResolvedValue(undefined);
  mockSql.notify = vi.fn().mockResolvedValue(undefined);
  return { default: vi.fn(() => mockSql) };
  /* eslint-enable @typescript-eslint/no-explicit-any */
});

import { isEligible } from "@/lib/sse-registry";

describe("isEligible", () => {
  const sub = { userId: "user-1", subLevel: 2 };

  it("allows all subscribers when targetType is 'all'", () => {
    expect(isEligible(sub, "all", null, null)).toBe(true);
    expect(isEligible({ userId: "other", subLevel: 0 }, "all", null, null)).toBe(true);
  });

  it("allows only matching user when targetType is 'user'", () => {
    expect(isEligible(sub, "user", "user-1", null)).toBe(true);
    expect(isEligible(sub, "user", "user-2", null)).toBe(false);
  });

  it("allows subscriber whose subLevel meets the target when targetType is 'sub_level'", () => {
    expect(isEligible(sub, "sub_level", null, 2)).toBe(true);
    expect(isEligible(sub, "sub_level", null, 1)).toBe(true);
    expect(isEligible(sub, "sub_level", null, 3)).toBe(false);
  });

  it("rejects when targetType is 'sub_level' and targetSubLevel is null", () => {
    expect(isEligible(sub, "sub_level", null, null)).toBe(false);
  });
});
