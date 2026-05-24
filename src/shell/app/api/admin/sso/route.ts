import { NextResponse } from "next/server";
import { withTenant } from "@/lib/db/tenant";
import { idpProviders } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { getTenantSlug } from "@/lib/tenant-slug";
import { eq } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const tenantSlug = getTenantSlug();
  const tenantDb = withTenant(tenantSlug);

  const rows = await tenantDb
    .select()
    .from(idpProviders)
    .where(eq(idpProviders.isEnabled, true))
    .limit(1);

  const config = rows[0];
  if (!config?.issuer) {
    return NextResponse.json({ connected: false, error: "No OIDC issuer configured" });
  }

  const issuer = config.issuer;
  const clientId = config.clientId;
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
