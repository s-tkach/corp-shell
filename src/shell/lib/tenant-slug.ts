export function getTenantSlug(): string {
  if (process.env.TENANT_SLUG) {
    return process.env.TENANT_SLUG;
  }
  return "default";
}
