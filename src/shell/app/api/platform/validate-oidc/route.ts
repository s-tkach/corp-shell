import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";
import { fetchOidcDiscovery, getPublicHttpsFieldError, isRemoteUrlValidationFailure } from "@/lib/remote-target-guard";

export async function GET(request: Request) {
  const session = await auth();
  if (!session || !isPlatformAdmin({ roles: session.user.roles ?? [], tenantSlug: session.user.tenantSlug ?? "" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const issuer = searchParams.get("issuer")?.trim();

  if (!issuer) {
    return NextResponse.json({ error: "issuer parameter is required" }, { status: 400 });
  }

  const discovery = await fetchOidcDiscovery(issuer);
  if (!discovery.ok) {
    const error = isRemoteUrlValidationFailure(discovery.kind)
      ? getPublicHttpsFieldError("issuer")
      : discovery.error;
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, issuer: discovery.data.issuer });
}
