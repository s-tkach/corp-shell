import NextAuth from "next-auth";
import { db } from "@/lib/db/client";
import { withTenant } from "@/lib/db/tenant";
import {
  users,
  roles,
  userRoles,
  idpGroupRoleMappings,
  subscriptionTiers,
  tenantSubscription,
  authEvents,
  tenants,
  userCompanies,
} from "@/lib/db/schema";
import { getTenantSlug, getPlatformSlug } from "@/lib/tenant-resolver";
import { getAuthConfig } from "@/lib/auth-config";
import { eq, inArray } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth(async (req) => {
  const host = req?.headers?.get("host") ?? process.env["NEXTAUTH_URL"] ?? "";
  const tenantSlug = getTenantSlug(host) ?? getPlatformSlug();

  const { providers } = await getAuthConfig(tenantSlug);

  return {
    secret: process.env["NEXTAUTH_SECRET"],
    pages: { signIn: "/login" },
    providers,
    callbacks: {
      async jwt({ token, account, profile, trigger }) {
        if (trigger === "signIn" && account && profile) {
          // Resolve tenant from host captured in factory closure
          const tenantRows = await db
            .select({ id: tenants.id, slug: tenants.slug })
            .from(tenants)
            .where(eq(tenants.slug, tenantSlug))
            .limit(1);
          const tenant = tenantRows[0];
          if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);

          token.tenantId = tenant.id;
          token.tenantSlug = tenant.slug;

          const tenantDb = withTenant(tenantSlug);

          if (account.id_token) {
            token.idToken = account.id_token;
          }

          const email = token.email ?? "";
          const sub = token.sub ?? "";

          const idpGroups: string[] = Array.isArray(
            (profile as Record<string, unknown>)["groups"]
          )
            ? ((profile as Record<string, unknown>)["groups"] as string[])
            : [];

          let roleSlugs: string[] = [];
          if (idpGroups.length > 0) {
            const mappings = await tenantDb
              .select({ slug: roles.slug })
              .from(idpGroupRoleMappings)
              .innerJoin(roles, eq(idpGroupRoleMappings.roleId, roles.id))
              .where(inArray(idpGroupRoleMappings.idpGroupName, idpGroups));
            roleSlugs = [...new Set(mappings.map((m) => m.slug))];
          }

          const existingUsers = await tenantDb
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          let userId: string;

          if (existingUsers.length === 0 || existingUsers[0] === undefined) {
            // New user — JIT provision
            const inserted = await tenantDb
              .insert(users)
              .values({
                email,
                displayName: (token.name as string | null) ?? email,
                idpSource: "oidc",
                idpSubject: sub,
              })
              .returning({ id: users.id });

            const newUser = inserted[0];
            if (!newUser) throw new Error("Failed to insert user");
            userId = newUser.id;

            if (roleSlugs.length > 0) {
              const roleRows = await tenantDb
                .select({ id: roles.id })
                .from(roles)
                .where(inArray(roles.slug, roleSlugs));
              if (roleRows.length > 0) {
                await tenantDb.insert(userRoles).values(
                  roleRows.map((r) => ({ userId, roleId: r.id }))
                );
              }
            }

            await tenantDb.insert(authEvents).values({
              userId,
              email,
              eventType: "JIT_PROVISION",
            });
          } else {
            // Existing user — update IDP linkage and last login
            // Handles the case where setup pre-seeded the user with idpSource: "pending"
            userId = existingUsers[0].id;

            await tenantDb
              .update(users)
              .set({ idpSource: "oidc", idpSubject: sub, lastLoginAt: new Date() })
              .where(eq(users.id, userId));

            const dbRoleRows = await tenantDb
              .select({ slug: roles.slug })
              .from(userRoles)
              .innerJoin(roles, eq(userRoles.roleId, roles.id))
              .where(eq(userRoles.userId, userId));
            roleSlugs = [...new Set([...roleSlugs, ...dbRoleRows.map((r) => r.slug)])];
          }

          await tenantDb.insert(authEvents).values({
            userId,
            email,
            eventType: "LOGIN",
          });

          const subRow = await db
            .select({
              slug: subscriptionTiers.slug,
              level: subscriptionTiers.level,
              expiresAt: tenantSubscription.expiresAt,
              status: tenantSubscription.status,
            })
            .from(tenantSubscription)
            .innerJoin(subscriptionTiers, eq(tenantSubscription.tierId, subscriptionTiers.id))
            .where(eq(tenantSubscription.tenantId, tenant.id))
            .limit(1);

          const tier = subRow[0];
          const companyRows = await tenantDb
            .select({ companyId: userCompanies.companyId })
            .from(userCompanies)
            .where(eq(userCompanies.userId, userId));

          const companyIds = companyRows.map((r) => r.companyId);
          token.companyIds = companyIds;
          token.companyId = companyIds[0] ?? null;

          token.userId = userId;
          token.roles = roleSlugs;
          token.subscriptionTier = tier?.slug ?? "free";
          token.subscriptionLevel = tier?.level ?? 0;
        }

        return token;
      },

      async session({ session, token }) {
        session.user.userId = (token.userId as string | undefined) ?? "";
        session.user.roles = (token.roles as string[] | undefined) ?? [];
        session.user.subscriptionTier =
          (token.subscriptionTier as string | undefined) ?? "free";
        session.user.subscriptionLevel =
          (token.subscriptionLevel as number | undefined) ?? 0;
        session.user.tenantId = (token.tenantId as string | undefined) ?? "";
        session.user.tenantSlug = (token.tenantSlug as string | undefined) ?? "";
        session.user.companyId = (token.companyId as string | null | undefined) ?? null;
        session.user.companyIds = (token.companyIds as string[] | undefined) ?? [];
        return session;
      },
    },
  };
});
