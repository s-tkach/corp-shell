import { decrypt } from "@/lib/crypto";
import { withTenant } from "@/lib/db/tenant";
import { idpProviders } from "@/lib/db/schema";
import { getPlatformSlug } from "@/lib/tenant-resolver";
import { eq } from "drizzle-orm";

export interface OidcProviderConfig {
  id: string;
  name: string;
  type: "oidc";
  issuer: string;
  clientId: string;
  clientSecret: string;
  client: { token_endpoint_auth_method: string };
  authorization: { params: { scope: string } };
}

export interface AuthConfig {
  providers: OidcProviderConfig[];
}

export async function getAuthConfig(tenantSlug: string): Promise<AuthConfig> {
  if (tenantSlug === getPlatformSlug()) {
    const issuer = process.env["PLATFORM_OIDC_ISSUER"]?.trim();
    const clientId = process.env["PLATFORM_OIDC_CLIENT_ID"]?.trim();
    const clientSecret = process.env["PLATFORM_OIDC_CLIENT_SECRET"]?.trim();

    if (issuer && clientId && clientSecret) {
      return {
        providers: [
          {
            id: "oidc",
            name: "Platform SSO",
            type: "oidc",
            issuer,
            clientId,
            clientSecret,
            client: { token_endpoint_auth_method: "client_secret_post" },
            authorization: { params: { scope: "openid profile email" } },
          },
        ],
      };
    }

    return { providers: [] };
  }

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
      tokenEndpointAuthMethod: idpProviders.tokenEndpointAuthMethod,
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
      client: { token_endpoint_auth_method: row.tokenEndpointAuthMethod },
      authorization: { params: { scope: row.scopes.join(" ") } },
    }))
  );

  return { providers };
}
