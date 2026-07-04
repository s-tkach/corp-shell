export const REMOTE_VALIDATION_TIMEOUT_MS = 8000;

const PRIVATE_HOST = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;

type RemoteUrlFailureKind = "invalid_url" | "https_required" | "private_target";
type RemoteCheckFailureKind = RemoteUrlFailureKind | "fetch_failed" | "invalid_document";

type RemoteUrlSuccess = {
  ok: true;
  url: URL;
  normalized: string;
};

type RemoteUrlFailure = {
  ok: false;
  kind: RemoteUrlFailureKind;
  error: string;
};

type RemoteCheckFailure = {
  ok: false;
  kind: RemoteCheckFailureKind;
  error: string;
};

type RemoteCheckSuccess<T> = {
  ok: true;
  data: T;
  response: Response;
};

export type RemoteUrlValidationResult = RemoteUrlSuccess | RemoteUrlFailure;
export type RemoteCheckResult<T> = RemoteCheckSuccess<T> | RemoteCheckFailure;

export function validateRemoteUrl(raw: string): RemoteUrlValidationResult {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, kind: "invalid_url", error: "Remote target must be a valid URL" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, kind: "https_required", error: "Remote target must use HTTPS" };
  }

  if (PRIVATE_HOST.test(url.hostname)) {
    return { ok: false, kind: "private_target", error: "Remote target must be publicly reachable" };
  }

  return {
    ok: true,
    url,
    normalized: normalizeRemoteUrl(url),
  };
}

export function getPublicHttpsFieldError(fieldName: string): string {
  return `${fieldName} must be a valid public HTTPS URL`;
}

export function isRemoteUrlValidationFailure(kind: RemoteCheckFailureKind): kind is RemoteUrlFailureKind {
  return kind === "invalid_url" || kind === "https_required" || kind === "private_target";
}

export async function fetchOidcDiscovery(issuer: string): Promise<RemoteCheckResult<Record<string, unknown> & { issuer: string; authorization_endpoint: string }>> {
  const validation = validateRemoteUrl(issuer);
  if (!validation.ok) return validation;

  const response = await fetchJsonDocument(buildOidcDiscoveryUrl(validation.normalized), "OIDC discovery failed");
  if (!response.ok) return response;

  const issuerValue = response.data["issuer"];
  const authorizationEndpoint = response.data["authorization_endpoint"];

  if (typeof issuerValue !== "string" || typeof authorizationEndpoint !== "string") {
    return { ok: false, kind: "invalid_document", error: "OIDC discovery document is invalid" };
  }

  return {
    ok: true,
    response: response.response,
    data: {
      ...response.data,
      issuer: issuerValue,
      authorization_endpoint: authorizationEndpoint,
    },
  };
}

export async function fetchRemoteManifest(remoteUrl: string): Promise<RemoteCheckResult<Record<string, unknown>>> {
  const validation = validateRemoteUrl(remoteUrl);
  if (!validation.ok) {
    return { ok: false, kind: validation.kind, error: "Manifest fetch failed" };
  }

  return fetchJsonDocument(buildManifestUrl(validation.normalized), "Manifest fetch failed");
}

export async function fetchHealthTarget(remoteUrl: string): Promise<RemoteCheckResult<null>> {
  const validation = validateRemoteUrl(remoteUrl);
  if (!validation.ok) {
    return { ok: false, kind: validation.kind, error: "Health check failed" };
  }

  try {
    const response = await fetch(validation.normalized, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(REMOTE_VALIDATION_TIMEOUT_MS),
    });

    return { ok: true, response, data: null };
  } catch {
    return { ok: false, kind: "fetch_failed", error: "Health check failed" };
  }
}

function normalizeRemoteUrl(url: URL): string {
  const normalized = new URL(url.toString());
  normalized.hash = "";
  if (normalized.pathname !== "/" && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.slice(0, -1);
  }
  return normalized.toString();
}

function buildOidcDiscoveryUrl(issuer: string): string {
  return new URL(".well-known/openid-configuration", ensureTrailingSlash(issuer)).toString();
}

function buildManifestUrl(remoteUrl: string): string {
  return new URL("mf-manifest.json", ensureTrailingSlash(remoteUrl)).toString();
}

function ensureTrailingSlash(raw: string): string {
  return raw.endsWith("/") ? raw : `${raw}/`;
}

async function fetchJsonDocument(url: string, fetchError: string): Promise<RemoteCheckResult<Record<string, unknown>>> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(REMOTE_VALIDATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { ok: false, kind: "fetch_failed", error: fetchError };
    }

    const data = await response.json();
    if (!isRecord(data)) {
      return { ok: false, kind: "invalid_document", error: fetchError };
    }

    return { ok: true, response, data };
  } catch {
    return { ok: false, kind: "fetch_failed", error: fetchError };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
