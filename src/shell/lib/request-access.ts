import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withTenant } from "@/lib/db/tenant";
import {
  subscriptionTiers,
  tenantSubscription,
  tenants,
  users,
} from "@/lib/db/schema";
import { getMenuRouteAccessForTenant } from "@/lib/menu";
import { isPlatformAdmin } from "@/lib/platform-guard";
import type { Session } from "next-auth";
import { resolveEffectiveTenantSubscriptionAccess } from "@/lib/effective-subscription";
import { getEffectiveRoleAssignmentsForUser } from "@/lib/role-assignments";

export type RequestAccessOutcome =
  | "allow"
  | "login"
  | "suspended"
  | "not_found"
  | "forbidden"
  | "upgrade";

interface EvaluateProtectedRequestAccessArgs {
  requestTenantSlug: string;
  sessionTenantSlug: string | undefined;
  tenantExists: boolean;
  tenantStatus: "active" | "suspended" | "deleted" | null;
  sessionUserId: string | undefined;
  userExists: boolean;
  userIsActive: boolean;
  routeAccess: "allow" | "upgrade" | "forbidden" | "unmatched";
}

export interface RequestAccessSnapshot {
  outcome: RequestAccessOutcome;
  userRoles: string[];
  subscriptionLevel: number;
  subscriptionTier: string;
  isPlatformAdmin: boolean;
}

export function mapRequestAccessOutcomeToDecision({
  outcome,
  pathname,
  isApi,
}: {
  outcome: RequestAccessOutcome;
  pathname: string;
  isApi: boolean;
}): "next" | "401" | "403" | "404" | "redirect:/login" | "redirect:/suspended" | "redirect:/upgrade" | "rewrite:/403" {
  if (outcome === "allow") {
    return "next";
  }

  if (outcome === "not_found") {
    return "404";
  }

  if (outcome === "login") {
    return isApi ? "401" : "redirect:/login";
  }

  if (outcome === "suspended") {
    return isApi ? "403" : "redirect:/suspended";
  }

  if (outcome === "upgrade") {
    return isApi || pathname.startsWith("/upgrade")
      ? "403"
      : "redirect:/upgrade";
  }

  return isApi ? "403" : "rewrite:/403";
}

export function evaluateProtectedRequestAccess({
  requestTenantSlug,
  sessionTenantSlug,
  tenantExists,
  tenantStatus,
  sessionUserId,
  userExists,
  userIsActive,
  routeAccess,
}: EvaluateProtectedRequestAccessArgs): RequestAccessOutcome {
  if (!tenantExists || tenantStatus === "deleted") {
    return "not_found";
  }

  if (tenantStatus !== "active") {
    return "suspended";
  }

  if (!sessionUserId) {
    return "login";
  }

  if (sessionTenantSlug !== requestTenantSlug) {
    return "forbidden";
  }

  if (!userExists || !userIsActive) {
    return "login";
  }

  if (routeAccess === "unmatched") {
    return "allow";
  }

  return routeAccess;
}

export async function getRequestAccessSnapshot({
  tenantSlug,
  pathname,
  session,
}: {
  tenantSlug: string;
  pathname: string;
  session: Session | null;
}): Promise<RequestAccessSnapshot> {
  const tenantRows = await db
    .select({ id: tenants.id, status: tenants.status })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  const tenant = tenantRows[0];

  if (!tenant) {
    return {
      outcome: "not_found",
      userRoles: [],
      subscriptionLevel: 0,
      subscriptionTier: "free",
      isPlatformAdmin: false,
    };
  }

  const userId = session?.user.userId;
  if (!userId) {
    return {
      outcome: evaluateProtectedRequestAccess({
        requestTenantSlug: tenantSlug,
        sessionTenantSlug: session?.user.tenantSlug,
        tenantExists: true,
        tenantStatus: tenant.status,
        sessionUserId: undefined,
        userExists: false,
        userIsActive: false,
        routeAccess: "unmatched",
      }),
      userRoles: [],
      subscriptionLevel: 0,
      subscriptionTier: "free",
      isPlatformAdmin: false,
    };
  }

  const tenantDb = withTenant(tenantSlug);
  const userRows = await tenantDb
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];

  const roleAssignments = user
    ? await getEffectiveRoleAssignmentsForUser(tenantDb, userId)
    : { manualRoles: [], idpRoles: [], effectiveRoles: [] };
  const userRolesList = roleAssignments.effectiveRoles.map((role) => role.slug);
  const platformAdmin = isPlatformAdmin({
    roles: userRolesList,
    tenantSlug,
  });

  const subscriptionRows = await db
    .select({
      slug: subscriptionTiers.slug,
      level: subscriptionTiers.level,
      status: tenantSubscription.status,
      expiresAt: tenantSubscription.expiresAt,
    })
    .from(tenantSubscription)
    .innerJoin(subscriptionTiers, eq(tenantSubscription.tierId, subscriptionTiers.id))
    .where(eq(tenantSubscription.tenantId, tenant.id))
    .limit(1);
  const subscription = subscriptionRows[0];

  const effectiveSubscription = subscription
    ? resolveEffectiveTenantSubscriptionAccess({
        slug: subscription.slug,
        level: subscription.level,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
      })
    : {
        effectiveTierSlug: "free",
        effectiveLevel: 0,
      };
  const subscriptionLevel = effectiveSubscription.effectiveLevel;
  const subscriptionTier = effectiveSubscription.effectiveTierSlug;

  const routeAccess = pathname
    ? await getMenuRouteAccessForTenant({
        tenantSlug,
        pathname,
        subscriptionLevel,
        userRoles: userRolesList,
        isPlatformAdmin: platformAdmin,
      })
    : "unmatched";

  return {
    outcome: evaluateProtectedRequestAccess({
      requestTenantSlug: tenantSlug,
      sessionTenantSlug: session.user.tenantSlug,
      tenantExists: true,
      tenantStatus: tenant.status,
      sessionUserId: userId,
      userExists: Boolean(user),
      userIsActive: user?.isActive ?? false,
      routeAccess,
    }),
    userRoles: userRolesList,
    subscriptionLevel,
    subscriptionTier,
    isPlatformAdmin: platformAdmin,
  };
}
