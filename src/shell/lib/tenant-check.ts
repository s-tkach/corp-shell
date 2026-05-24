export function isTenantMismatch(
  tokenSlug: string | undefined,
  hostSlug: string | null
): boolean {
  if (!hostSlug) return false;
  if (!tokenSlug) return true;
  return tokenSlug !== hostSlug;
}
