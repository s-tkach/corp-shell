import { describe, it, expect, vi, beforeEach } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("postgres", () => {
  const mockSql = vi.fn().mockResolvedValue([]) as any;
  mockSql.end = vi.fn().mockResolvedValue(undefined);
  mockSql.unsafe = vi.fn().mockResolvedValue([]);
  const postgres = vi.fn(() => mockSql) as any;
  return { default: postgres };
});

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn((client: any, opts: any) => ({ _client: client, _schema: opts?.schema })) as any,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock("@/lib/db/client", () => ({ connectionString: "postgres://test", db: undefined }));

describe("withTenant", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it("creates a drizzle client for the given tenant slug", async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const postgres = (await import("postgres")).default as any;
    const { drizzle } = await import("drizzle-orm/postgres-js") as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const { withTenant } = await import("@/lib/db/tenant");

    const client = withTenant("acme");

    expect(postgres).toHaveBeenCalledWith(
      "postgres://test",
      expect.objectContaining({
        connection: { search_path: "tenant_acme,public" },
      })
    );
    expect(drizzle).toHaveBeenCalled();
    expect(client).toBeDefined();
  });

  it("uses different search_path for different slugs", async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const postgres = (await import("postgres")).default as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const { withTenant } = await import("@/lib/db/tenant");

    withTenant("acme");
    withTenant("globocorp");

    const calls = postgres.mock.calls;
    expect(calls[0]?.[1]).toMatchObject({ connection: { search_path: "tenant_acme,public" } });
    expect(calls[1]?.[1]).toMatchObject({ connection: { search_path: "tenant_globocorp,public" } });
  });
});

describe("provisionTenant", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it("throws if slug contains invalid characters", async () => {
    const { provisionTenant } = await import("@/lib/db/provision");

    await expect(provisionTenant("acme corp", "Acme", "a@b.com")).rejects.toThrow(
      "Invalid slug"
    );
    await expect(provisionTenant("ACME", "Acme", "a@b.com")).rejects.toThrow("Invalid slug");
    await expect(provisionTenant("acme_corp", "Acme", "a@b.com")).rejects.toThrow("Invalid slug");
  });

  it("allows valid slug patterns", async () => {
    const { provisionTenant } = await import("@/lib/db/provision");

    try {
      await provisionTenant("acme-corp-123", "Acme", "a@b.com");
    } catch (e: unknown) {
      const error = e as Error;
      expect(error.message).not.toBe("Invalid slug");
    }
  });

  it("rolls back and drops schema on DDL failure", async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const postgres = (await import("postgres")).default as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no existing tenant
    };
    vi.doMock("@/lib/db/client", () => ({ connectionString: "postgres://test", db: mockDb }));

    let unsafeCallCount = 0;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mockTx: any = vi.fn().mockResolvedValue([]);
    mockTx.unsafe = vi.fn().mockImplementation(() => {
      unsafeCallCount++;
      // Fail on DDL execution (second unsafe call: CREATE SCHEMA, DDL)
      if (unsafeCallCount === 2) throw new Error("DDL failure");
      return Promise.resolve([]);
    });
    const mockSql: any = vi.fn().mockResolvedValue([]);
    mockSql.end = vi.fn().mockResolvedValue(undefined);
    mockSql.unsafe = vi.fn().mockResolvedValue([]);
    mockSql.begin = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(mockTx));
    postgres.mockReturnValue(mockSql);

    const { provisionTenant } = await import("@/lib/db/provision");

    await expect(provisionTenant("newco", "NewCo", "")).rejects.toThrow();

    // DROP SCHEMA must have been attempted via the outer sql (not tx)
    const unsafeCalls: string[] = mockSql.unsafe.mock.calls.map((c: any[]) => String(c[0]));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    expect(unsafeCalls.some((c) => c.includes("DROP SCHEMA"))).toBe(true);
    // sql.end must have been called (connection closed)
    expect(mockSql.end).toHaveBeenCalled();
  });

  it("rolls back and drops schema on seed failure", async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const postgres = (await import("postgres")).default as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.doMock("@/lib/db/client", () => ({ connectionString: "postgres://test", db: mockDb }));

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mockTx: any = vi.fn().mockImplementation(() => {
      // Fail on first tagged query (tenant INSERT) to simulate seed failure
      throw new Error("Seed failure");
    });
    mockTx.unsafe = vi.fn().mockResolvedValue([]);
    const mockSql: any = vi.fn().mockResolvedValue([]);
    mockSql.end = vi.fn().mockResolvedValue(undefined);
    mockSql.unsafe = vi.fn().mockResolvedValue([]);
    mockSql.begin = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(mockTx));
    postgres.mockReturnValue(mockSql);

    const { provisionTenant } = await import("@/lib/db/provision");

    await expect(provisionTenant("newco2", "NewCo", "")).rejects.toThrow();

    const unsafeCalls: string[] = mockSql.unsafe.mock.calls.map((c: any[]) => String(c[0]));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    expect(unsafeCalls.some((c) => c.includes("DROP SCHEMA"))).toBe(true);
    expect(mockSql.end).toHaveBeenCalled();
  });
});
