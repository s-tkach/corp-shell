import { describe, expect, it } from "vitest";
import { resolveEffectiveTenantSubscriptionAccess } from "@/lib/effective-subscription";

describe("resolveEffectiveTenantSubscriptionAccess", () => {
  it("keeps free access even when expiresAt is in the past", () => {
    expect(
      resolveEffectiveTenantSubscriptionAccess({
        slug: "free",
        level: 0,
        status: "canceled",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        now: new Date("2026-06-19T12:00:00.000Z"),
      })
    ).toMatchObject({
      effectiveTierSlug: "free",
      effectiveLevel: 0,
      isActiveForAccess: true,
      downgradedToFree: false,
    });
  });

  it("downgrades a paid tier when the subscription status is not active for access", () => {
    expect(
      resolveEffectiveTenantSubscriptionAccess({
        slug: "enterprise",
        level: 2,
        status: "past_due",
        expiresAt: null,
        now: new Date("2026-06-19T12:00:00.000Z"),
      })
    ).toMatchObject({
      effectiveTierSlug: "free",
      effectiveLevel: 0,
      isActiveForAccess: false,
      downgradedToFree: true,
    });
  });

  it("downgrades a paid tier when expiresAt is in the past", () => {
    expect(
      resolveEffectiveTenantSubscriptionAccess({
        slug: "standard",
        level: 1,
        status: "active",
        expiresAt: new Date("2026-06-18T23:59:59.000Z"),
        now: new Date("2026-06-19T12:00:00.000Z"),
      })
    ).toMatchObject({
      effectiveTierSlug: "free",
      effectiveLevel: 0,
      isActiveForAccess: false,
      downgradedToFree: true,
    });
  });

  it("preserves a paid tier when status is active and expiresAt is in the future", () => {
    expect(
      resolveEffectiveTenantSubscriptionAccess({
        slug: "standard",
        level: 1,
        status: "active",
        expiresAt: new Date("2026-06-20T00:00:00.000Z"),
        now: new Date("2026-06-19T12:00:00.000Z"),
      })
    ).toMatchObject({
      effectiveTierSlug: "standard",
      effectiveLevel: 1,
      isActiveForAccess: true,
      downgradedToFree: false,
    });
  });
});
