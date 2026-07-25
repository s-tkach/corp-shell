export function getAuthCookies(namespace?: string) {
  if (!namespace) return undefined;

  const prefix = `authjs.${namespace}`;

  return {
    sessionToken: {
      name: `${prefix}.session-token`,
    },
    callbackUrl: {
      name: `${prefix}.callback-url`,
    },
    csrfToken: {
      name: `${prefix}.csrf-token`,
    },
    pkceCodeVerifier: {
      name: `${prefix}.pkce.code_verifier`,
    },
    state: {
      name: `${prefix}.state`,
    },
    nonce: {
      name: `${prefix}.nonce`,
    },
    webauthnChallenge: {
      name: `${prefix}.challenge`,
    },
  };
}

export function getPkceCodeVerifierCookieName(namespace?: string): string | null {
  const cookies = getAuthCookies(namespace);
  return cookies?.pkceCodeVerifier.name ?? null;
}
