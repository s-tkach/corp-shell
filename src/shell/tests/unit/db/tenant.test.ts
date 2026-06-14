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

    await expect(provisionTenant("acme corp", "Acme", "a@b.com", "tier-free")).rejects.toThrow(
      "Invalid slug"
    );
    await expect(provisionTenant("ACME", "Acme", "a@b.com", "tier-free")).rejects.toThrow("Invalid slug");
    await expect(provisionTenant("acme_corp", "Acme", "a@b.com", "tier-free")).rejects.toThrow("Invalid slug");
  });

  it("allows valid slug patterns", async () => {
    const { provisionTenant } = await import("@/lib/db/provision");

    try {
      await provisionTenant("acme-corp-123", "Acme", "a@b.com", "tier-free");
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
      limit: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "tier-free" }]),
    };
    vi.doMock("@/lib/db/client", () => ({ connectionString: "postgres://test", db: mockDb }));

    let unsafeCallCount = 0;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mockTx: any = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("INSERT INTO public.tenants")) {
        return Promise.resolve([{ id: "tenant-1", slug: "newco" }]);
      }
      if (query.includes("INSERT INTO public.tenant_subscription")) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
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

    await expect(provisionTenant("newco", "NewCo", "", "tier-free")).rejects.toThrow();

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
      limit: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "tier-free" }]),
    };
    vi.doMock("@/lib/db/client", () => ({ connectionString: "postgres://test", db: mockDb }));

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mockTx: any = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("INSERT INTO public.tenants")) {
        return Promise.resolve([{ id: "tenant-2", slug: "newco2" }]);
      }
      if (query.includes("INSERT INTO public.tenant_subscription")) {
        return Promise.resolve([]);
      }
      if (query.includes("INSERT INTO roles (slug, display_name, is_system)") && query.includes("RETURNING id")) {
        throw new Error("Seed failure");
      }
      return Promise.resolve([]);
    });
    mockTx.unsafe = vi.fn().mockResolvedValue([]);
    const mockSql: any = vi.fn().mockResolvedValue([]);
    mockSql.end = vi.fn().mockResolvedValue(undefined);
    mockSql.unsafe = vi.fn().mockResolvedValue([]);
    mockSql.begin = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(mockTx));
    postgres.mockReturnValue(mockSql);

    const { provisionTenant } = await import("@/lib/db/provision");

    await expect(provisionTenant("newco2", "NewCo", "", "tier-free")).rejects.toThrow();

    const unsafeCalls: string[] = mockSql.unsafe.mock.calls.map((c: any[]) => String(c[0]));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    expect(unsafeCalls.some((c) => c.includes("DROP SCHEMA"))).toBe(true);
    expect(mockSql.end).toHaveBeenCalled();
  });

  it("assigns the selected tier to tenant_subscription", async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const postgres = (await import("postgres")).default as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "tier-standard" }]),
    };
    vi.doMock("@/lib/db/client", () => ({ connectionString: "postgres://test", db: mockDb }));

    const taggedCalls: Array<{ strings: string[]; values: unknown[] }> = [];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mockTx: any = vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
      taggedCalls.push({ strings: Array.from(strings), values });
      const query = strings.join(" ");
      if (query.includes("INSERT INTO public.tenants")) {
        return Promise.resolve([{ id: "tenant-1", slug: "acme" }]);
      }
      if (query.includes("INSERT INTO public.tenant_subscription")) {
        return Promise.resolve([]);
      }
      if (query.includes("INSERT INTO roles (slug, display_name, is_system)") && query.includes("RETURNING id")) {
        return Promise.resolve([{ id: "role-super-admin" }]);
      }
      if (query.includes("INSERT INTO companies (name)")) {
        return Promise.resolve([{ id: "company-root" }]);
      }
      if (query.includes("INSERT INTO users (email, display_name, idp_source, idp_subject, is_active)")) {
        return Promise.resolve([{ id: "user-admin" }]);
      }
      return Promise.resolve([]);
    });
    mockTx.unsafe = vi.fn().mockResolvedValue([]);
    const mockSql: any = vi.fn().mockResolvedValue([]);
    mockSql.end = vi.fn().mockResolvedValue(undefined);
    mockSql.unsafe = vi.fn().mockResolvedValue([]);
    mockSql.begin = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(mockTx));
    postgres.mockReturnValue(mockSql);

    const { provisionTenant } = await import("@/lib/db/provision");

    await provisionTenant("acme", "Acme", "admin@acme.com", "tier-standard");

    const subscriptionInsert = taggedCalls.find((call) =>
      call.strings.join(" ").includes("INSERT INTO public.tenant_subscription")
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
    expect(subscriptionInsert?.values).toContain("tier-standard");
  });
});
