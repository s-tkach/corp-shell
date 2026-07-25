export function getDevFreshPlatformOidcEnv(
  env: Record<string, string | undefined>
): Record<string, string> | null {
  const platformIssuer = env["PLATFORM_OIDC_ISSUER"]?.trim();
  const platformClientId = env["PLATFORM_OIDC_CLIENT_ID"]?.trim();
  const platformClientSecret = env["PLATFORM_OIDC_CLIENT_SECRET"]?.trim();

  if (platformIssuer && platformClientId && platformClientSecret) {
    return {
      PLATFORM_OIDC_ISSUER: platformIssuer,
      PLATFORM_OIDC_CLIENT_ID: platformClientId,
      PLATFORM_OIDC_CLIENT_SECRET: platformClientSecret,
    };
  }

  const setupIssuer = env["SETUP_ISSUER"]?.trim();
  const setupClientId = env["SETUP_CLIENT_ID"]?.trim();
  const setupClientSecret = env["SETUP_CLIENT_SECRET"]?.trim();

  if (setupIssuer && setupClientId && setupClientSecret) {
    return {
      PLATFORM_OIDC_ISSUER: setupIssuer,
      PLATFORM_OIDC_CLIENT_ID: setupClientId,
      PLATFORM_OIDC_CLIENT_SECRET: setupClientSecret,
    };
  }

  return null;
}

export function updateDevFreshEnvValue(source: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const expression = new RegExp(`^${key}=.*$`, "gm");

  if (expression.test(source)) {
    return source.replace(expression, line);
  }

  return `${source}${source.endsWith("\n") ? "" : "\n"}${line}\n`;
}
