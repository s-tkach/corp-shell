const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export interface TenantSubscriptionRecord {
  slug: string;
  level: number;
  status: string;
  expiresAt: Date | null;
}

export interface EffectiveTenantSubscriptionAccess {
  effectiveTierSlug: string;
  effectiveLevel: number;
  isActiveForAccess: boolean;
  downgradedToFree: boolean;
}

export function resolveEffectiveTenantSubscriptionAccess({
  slug,
  level,
  status,
  expiresAt,
  now = new Date(),
}: TenantSubscriptionRecord & { now?: Date }): EffectiveTenantSubscriptionAccess {
  if (slug === "free") {
    return {
      effectiveTierSlug: "free",
      effectiveLevel: 0,
      isActiveForAccess: true,
      downgradedToFree: false,
    };
  }

  const isStatusActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
  const isExpired = expiresAt !== null && expiresAt.getTime() < now.getTime();
  const isActiveForAccess = isStatusActive && !isExpired;

  if (!isActiveForAccess) {
    return {
      effectiveTierSlug: "free",
      effectiveLevel: 0,
      isActiveForAccess: false,
      downgradedToFree: true,
    };
  }

  return {
    effectiveTierSlug: slug,
    effectiveLevel: level,
    isActiveForAccess: true,
    downgradedToFree: false,
  };
}
