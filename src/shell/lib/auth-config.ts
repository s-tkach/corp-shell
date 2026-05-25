import { decrypt } from "@/lib/crypto";
import { withTenant } from "@/lib/db/tenant";
import { idpProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface OidcProviderConfig {
  id: string;
  name: string;
  type: "oidc";
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorization: { params: { scope: string } };
}

export interface AuthConfig {
  providers: OidcProviderConfig[];
}

export async function getAuthConfig(tenantSlug: string): Promise<AuthConfig> {
  const tenantDb = withTenant(tenantSlug);

  const rows = await tenantDb
    .select({
      id: idpProviders.id,
      slug: idpProviders.slug,
      displayName: idpProviders.displayName,
      issuer: idpProviders.issuer,
      clientId: idpProviders.clientId,
      encryptedClientSecret: idpProviders.encryptedClientSecret,
      scopes: idpProviders.scopes,
    })
    .from(idpProviders)
    .where(eq(idpProviders.isEnabled, true));

  const providers: OidcProviderConfig[] = await Promise.all(
    rows.map(async (row) => ({
      id: row.slug,
      name: row.displayName,
      type: "oidc" as const,
      issuer: row.issuer,
      clientId: row.clientId,
      clientSecret: await decrypt(row.encryptedClientSecret),
      authorization: { params: { scope: row.scopes.join(" ") } },
    }))
  );

  return { providers };
}
