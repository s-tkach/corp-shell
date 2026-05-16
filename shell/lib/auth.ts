import NextAuth from "next-auth";
import Okta from "next-auth/providers/okta";
import { db } from "@/lib/db/client";
import {
  users,
  roles,
  userRoles,
  idpGroupRoleMappings,
  subscriptionTiers,
  userSubscriptions,
  authEvents,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env["NEXTAUTH_SECRET"],
  providers: [
    Okta({
      clientId: process.env["OKTA_CLIENT_ID"]!,
      clientSecret: process.env["OKTA_CLIENT_SECRET"]!,
      issuer: `https://${process.env["OKTA_DOMAIN"]}/oauth2/default`,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      // On initial sign-in, account and profile are present
      if (trigger === "signIn" && account && profile) {
        // Store the id_token for RP-initiated logout
        if (account.id_token) {
          token.idToken = account.id_token;
        }

        const email = token.email ?? "";
        const sub = token.sub ?? "";

        // Resolve groups from Okta profile (custom claim)
        const oktaGroups: string[] = Array.isArray(
          (profile as Record<string, unknown>)["groups"]
        )
          ? ((profile as Record<string, unknown>)["groups"] as string[])
          : [];

        // Resolve role slugs from group mappings
        let roleSlugs: string[] = [];
        if (oktaGroups.length > 0) {
          const mappings = await db
            .select({ slug: roles.slug })
            .from(idpGroupRoleMappings)
            .innerJoin(roles, eq(idpGroupRoleMappings.roleId, roles.id))
            .where(inArray(idpGroupRoleMappings.idpGroupName, oktaGroups));
          roleSlugs = [...new Set(mappings.map((m) => m.slug))];
        }

        // Look up or provision the user
        const existingUsers = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        let userId: string;

        if (existingUsers.length === 0 || existingUsers[0] === undefined) {
          // JIT provisioning
          const inserted = await db
            .insert(users)
            .values({
              email,
              displayName: (token.name as string | null) ?? email,
              idpSource: "okta",
              idpSubject: sub,
            })
            .returning({ id: users.id });

          const newUser = inserted[0];
          if (!newUser) throw new Error("Failed to insert user");
          userId = newUser.id;

          // Assign roles
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

          // Assign free tier subscription
          const freeTier = await db
            .select({ id: subscriptionTiers.id })
            .from(subscriptionTiers)
            .where(eq(subscriptionTiers.slug, "free"))
            .limit(1);
          if (freeTier[0]) {
            await db.insert(userSubscriptions).values({
              userId,
              tierId: freeTier[0].id,
            });
          }

          // Log JIT provisioning event
          await db.insert(authEvents).values({
            userId,
            email,
            eventType: "JIT_PROVISION",
          });
        } else {
          userId = existingUsers[0].id;

          // Update lastLoginAt for existing users
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, userId));
        }

        // Log LOGIN event
        await db.insert(authEvents).values({
          userId,
          email,
          eventType: "LOGIN",
        });

        // Resolve subscription for token
        const subRow = await db
          .select({
            id: userSubscriptions.id,
            slug: subscriptionTiers.slug,
            level: subscriptionTiers.level,
            expiresAt: userSubscriptions.expiresAt,
          })
          .from(userSubscriptions)
          .innerJoin(
            subscriptionTiers,
            eq(userSubscriptions.tierId, subscriptionTiers.id)
          )
          .where(eq(userSubscriptions.userId, userId))
          .limit(1);

        let tier = subRow[0];

        // Downgrade expired subscriptions to free
        if (tier && tier.expiresAt && tier.expiresAt < new Date() && tier.slug !== "free") {
          const freeTier = await db
            .select({ id: subscriptionTiers.id, slug: subscriptionTiers.slug, level: subscriptionTiers.level })
            .from(subscriptionTiers)
            .where(eq(subscriptionTiers.slug, "free"))
            .limit(1);
          if (freeTier[0]) {
            await db
              .update(userSubscriptions)
              .set({ tierId: freeTier[0].id, expiresAt: null })
              .where(eq(userSubscriptions.id, tier.id));
            tier = { ...freeTier[0], id: tier.id, expiresAt: null };
          }
        }

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
});
