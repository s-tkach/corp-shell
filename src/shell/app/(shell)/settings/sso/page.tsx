import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { idpProviders } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { SsoClient } from "./sso-client";

export default async function SsoPage() {
  const session = await auth();
  const tenantSlug = session?.user.tenantSlug ?? "";
  const tenantDb = withTenant(tenantSlug);

  const providers = await tenantDb
    .select({
      id: idpProviders.id,
      slug: idpProviders.slug,
      displayName: idpProviders.displayName,
      issuer: idpProviders.issuer,
      clientId: idpProviders.clientId,
      scopes: idpProviders.scopes,
      groupClaimName: idpProviders.groupClaimName,
      isEnabled: idpProviders.isEnabled,
    })
    .from(idpProviders)
    .orderBy(asc(idpProviders.createdAt));

  return (
    <div className="p-6">
      <SsoClient initialProviders={providers} />
    </div>
  );
}
