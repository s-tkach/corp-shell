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
  if (!config?.oktaDomain) {
    return NextResponse.json({ connected: false, error: "No Okta domain configured" });
  }

  const domain = config.oktaDomain;
  const clientId = config.oktaClientId;

  try {
    const res = await fetch(`https://${domain}/.well-known/openid-configuration`, {
      next: { revalidate: 0 },
    });
    if (res.ok) {
      return NextResponse.json({ connected: true, domain, clientId });
    }
    return NextResponse.json({
      connected: false,
      domain,
      clientId,
      error: `HTTP ${res.status} from Okta discovery endpoint`,
    });
  } catch (e) {
    return NextResponse.json({
      connected: false,
      domain,
      clientId,
      error: e instanceof Error ? e.message : "Network error",
    });
  }
}
