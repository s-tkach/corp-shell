import { handlers } from "@/lib/auth";
import { getPkceCodeVerifierCookieName } from "@/lib/auth-cookies";
import { NextResponse, type NextRequest } from "next/server";

function getStaleCallbackRedirect(request: NextRequest) {
  const pkceCookieName = getPkceCodeVerifierCookieName(
    process.env["AUTH_COOKIE_NAMESPACE"]
  );

  if (
    request.nextUrl.pathname.startsWith("/api/auth/callback/") &&
    pkceCookieName &&
    !request.cookies.has(pkceCookieName)
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return null;
}

export async function GET(request: NextRequest) {
  const staleCallbackRedirect = getStaleCallbackRedirect(request);
  if (staleCallbackRedirect) return staleCallbackRedirect;

  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const staleCallbackRedirect = getStaleCallbackRedirect(request);
  if (staleCallbackRedirect) return staleCallbackRedirect;

  return handlers.POST(request);
}
