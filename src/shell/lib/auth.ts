import NextAuth from "next-auth";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import {
  users,
  roles,
  userRoles,
  idpGroupRoleMappings,
  subscriptionTiers,
  tenantSubscription,
  authEvents,
  idpProviders,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

async function getOidcConfig() {
  const rows = await db
    .select()
    .from(idpProviders)
    .where(eq(idpProviders.isEnabled, true))
    .limit(1);
  const provider = rows[0];
  if (!provider) {
    throw new Error("No IDP configured — complete setup first");
  }
  return {
    id: provider.id,
    issuer: provider.issuer,
    clientId: provider.clientId,
    clientSecret: await decrypt(provider.encryptedClientSecret),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const { issuer, clientId, clientSecret } = await getOidcConfig();

  return {
    secret: process.env["NEXTAUTH_SECRET"],
    pages: { signIn: "/login" },
    providers: [
      {
        id: "oidc",
        name: "OIDC",
        type: "oidc",
        issuer,
        clientId,
        clientSecret,
        style: { logo: "" },
      },
    ],
    callbacks: {
      async jwt({ token, account, profile, trigger }) {
        if (trigger === "signIn" && account && profile) {
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
            const mappings = await db
              .select({ slug: roles.slug })
              .from(idpGroupRoleMappings)
              .innerJoin(roles, eq(idpGroupRoleMappings.roleId, roles.id))
              .where(inArray(idpGroupRoleMappings.idpGroupName, idpGroups));
            roleSlugs = [...new Set(mappings.map((m) => m.slug))];
          }

          const existingUsers = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          let userId: string;

          if (existingUsers.length === 0 || existingUsers[0] === undefined) {
            const inserted = await db
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
              const roleRows = await db
                .select({ id: roles.id })
                .from(roles)
                .where(inArray(roles.slug, roleSlugs));
              if (roleRows.length > 0) {
                await db.insert(userRoles).values(
                  roleRows.map((r) => ({ userId, roleId: r.id }))
                );
              }
            }

            await db.insert(authEvents).values({
              userId,
              email,
              eventType: "JIT_PROVISION",
            });
          } else {
            userId = existingUsers[0].id;

            await db
              .update(users)
              .set({ lastLoginAt: new Date() })
              .where(eq(users.id, userId));

            const dbRoleRows = await db
              .select({ slug: roles.slug })
              .from(userRoles)
              .innerJoin(roles, eq(userRoles.roleId, roles.id))
              .where(eq(userRoles.userId, userId));
            roleSlugs = [...new Set([...roleSlugs, ...dbRoleRows.map((r) => r.slug)])];
          }

          await db.insert(authEvents).values({
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
            .limit(1);

          const tier = subRow[0];
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
        return session;
      },
    },
  };
});
