export function getTenantSlug(host: string): string | null {
  const override = process.env["TENANT_SLUG"];
  if (override) return override;

  const hostname = host.split(":")[0] ?? host;
  const parts = hostname.split(".");

  if (parts.length < 2) return null;

  const subdomain = parts[0];
  const rest = parts.slice(1);

  // Two-part hostname: subdomain only if second part is "localhost" (local dev)
  // e.g. "acme.localhost" → "acme", "example.com" → null
  if (rest.length === 1 && rest[0] !== "localhost") return null;

  return subdomain ?? null;
}
