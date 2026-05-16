import { type NextRequest, NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authEvents } from "@/lib/db/schema";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const session = await auth();

  // Read idToken from the JWT before clearing the session
  const rawToken = await getToken({
    req: request,
    secret: process.env["NEXTAUTH_SECRET"]!,
  });

  const idToken = rawToken?.idToken as string | undefined;

  if (session?.user) {
    await db.insert(authEvents).values({
      userId: session.user.userId || null,
      email: session.user.email ?? null,
      eventType: "LOGOUT",
    });
  }

  // Clear the local session cookie
  await signOut({ redirect: false });

  const oktaDomain = process.env["OKTA_DOMAIN"];
  const origin = request.nextUrl.origin;

  if (idToken && oktaDomain) {
    const logoutUrl = new URL(
      `https://${oktaDomain}/oauth2/default/v1/logout`
    );
    logoutUrl.searchParams.set("id_token_hint", idToken);
    logoutUrl.searchParams.set("post_logout_redirect_uri", origin);
    return NextResponse.redirect(logoutUrl.toString());
  }

  return NextResponse.redirect(origin);
}
