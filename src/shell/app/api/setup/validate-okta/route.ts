import { NextResponse } from "next/server";

// Redirects legacy callers to the generic OIDC validator.
// This file can be deleted once the setup wizard no longer references this path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const domain = searchParams.get("domain")?.trim();
  if (!domain) {
    return NextResponse.json({ error: "domain parameter is required" }, { status: 400 });
  }
  const issuer = encodeURIComponent(`https://${domain}`);
  return NextResponse.redirect(`${origin}/api/setup/validate-oidc?issuer=${issuer}`);
}
