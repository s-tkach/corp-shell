import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check setup_complete cookie set by the app after setup finishes
  const setupComplete = request.cookies.get("shell_setup_complete")?.value === "1";

  if (pathname.startsWith("/setup")) {
    // /setup is permanently closed after setup completes
    if (setupComplete) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  if (!setupComplete) {
    // Redirect all non-setup traffic to /setup on a fresh DB
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/setup|_next/static|_next/image|favicon.ico).*)",
  ],
};
