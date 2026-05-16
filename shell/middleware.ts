import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";

async function getSetupComplete(): Promise<boolean> {
  const rows = await db
    .select({ setupComplete: shellConfig.setupComplete })
    .from(shellConfig)
    .limit(1);
  return rows[0]?.setupComplete ?? false;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const setupComplete = await getSetupComplete();

  if (!setupComplete) {
    if (pathname !== "/setup") {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next();
  }

  // Setup is complete — /setup is now inaccessible
  if (pathname === "/setup") {
    return new NextResponse(null, { status: 404 });
  }

  // Require authenticated session for all other routes
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
