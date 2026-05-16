import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";

export async function GET() {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }

  const rows = await db.select().from(shellConfig).limit(1);
  const config = rows[0];
  if (!config?.oidcIssuer) {
    return NextResponse.json({ connected: false, error: "No OIDC issuer configured" });
  }

  const issuer = config.oidcIssuer;
  const clientId = config.oidcClientId;
  const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;

  try {
    const res = await fetch(discoveryUrl, { next: { revalidate: 0 } });
    if (res.ok) {
      return NextResponse.json({ connected: true, issuer, clientId });
    }
    return NextResponse.json({
      connected: false,
      issuer,
      clientId,
      error: `HTTP ${res.status} from OIDC discovery endpoint`,
    });
  } catch (e) {
    return NextResponse.json({
      connected: false,
      issuer,
      clientId,
      error: e instanceof Error ? e.message : "Network error",
    });
  }
}
