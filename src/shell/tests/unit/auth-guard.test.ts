import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({ body, status: init?.status })),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/tenant", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  roles: {},
  rolePolicies: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));

describe("requirePolicy", () => {
  it("exports requirePolicy as a function", async () => {
    const mod = await import("@/lib/auth-guard");
    expect(typeof mod.requirePolicy).toBe("function");
  });
});
