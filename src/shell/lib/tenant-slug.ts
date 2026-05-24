/**
 * Gets the tenant slug from environment or host header.
 *
 * In M16 (single-tenant mode), defaults to env.TENANT_SLUG.
 * In M17+, this will also support host-based routing.
 */
export function getTenantSlug(): string {
  if (process.env.TENANT_SLUG) {
    return process.env.TENANT_SLUG;
  }
  // For now, return a hardcoded default for single-tenant compatibility
  return "default";
}
