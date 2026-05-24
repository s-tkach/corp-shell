import { type NextRequest, NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { authEvents, idpProviders } from "@/lib/db/schema";
import { getToken } from "next-auth/jwt";
import { getTenantSlug } from "@/lib/tenant-slug";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();

  // Read idToken from the JWT before clearing the session
  const rawToken = await getToken({
    req: request,
    secret: process.env["NEXTAUTH_SECRET"]!,
  });

  const idToken = rawToken?.idToken as string | undefined;

  if (session?.user) {
    const tenantSlug = getTenantSlug();
    const tenantDb = withTenant(tenantSlug);
    await tenantDb.insert(authEvents).values({
      userId: session.user.userId || null,
      email: session.user.email ?? null,
      eventType: "LOGOUT",
    });
  }

  // Clear the local session cookie
  await signOut({ redirect: false });

  const tenantSlug = getTenantSlug();
  const tenantDb = withTenant(tenantSlug);
  const configRows = await tenantDb
    .select({ issuer: idpProviders.issuer })
    .from(idpProviders)
    .where(eq(idpProviders.isEnabled, true))
    .limit(1);
  const oidcIssuer = configRows[0]?.issuer ?? null;
  const origin = request.nextUrl.origin;

  if (idToken && oidcIssuer) {
    try {
      const discoveryRes = await fetch(
        `${oidcIssuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (discoveryRes.ok) {
        const discovery = (await discoveryRes.json()) as Record<string, unknown>;
        const endSessionEndpoint = discovery["end_session_endpoint"];
        if (typeof endSessionEndpoint === "string") {
          const logoutUrl = new URL(endSessionEndpoint);
          logoutUrl.searchParams.set("id_token_hint", idToken);
          logoutUrl.searchParams.set("post_logout_redirect_uri", origin);
          return NextResponse.redirect(logoutUrl.toString());
        }
      }
    } catch {
      // fall through to local redirect
    }
  }

  return NextResponse.redirect(origin);
}
