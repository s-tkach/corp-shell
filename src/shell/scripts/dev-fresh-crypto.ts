export type DevFreshCryptoProvider = "kms" | "local";

const HEX_64_RE = /^[0-9a-fA-F]{64}$/;

function parseDevFreshEnvValue(rawValue: string): string {
  const value = rawValue.trim();

  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseDevFreshEnv(source: string): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    vars[key] = parseDevFreshEnvValue(value);
  }

  return vars;
}

export function resolveDevFreshCryptoProvider(
  env: Record<string, string | undefined>
): DevFreshCryptoProvider | null {
  const provider = env["ENCRYPTION_PROVIDER"];

  if (provider) {
    if (provider === "kms") {
      return "kms";
    }

    if (provider === "local") {
      return "local";
    }

    return null;
  }

  if (env["KMS_KEY_ID"]) {
    return "kms";
  }

  if (env["ENCRYPTION_KEY"]) {
    return "local";
  }

  return null;
}

export function getDevFreshCryptoPreflightError(
  env: Record<string, string | undefined>
): string | null {
  const configuredProvider = env["ENCRYPTION_PROVIDER"];

  if (
    configuredProvider &&
    configuredProvider !== "kms" &&
    configuredProvider !== "local"
  ) {
    return "Invalid local encryption config: ENCRYPTION_PROVIDER must be 'kms' or 'local'.";
  }

  const provider = resolveDevFreshCryptoProvider(env);

  if (provider === "local") {
    const key = env["ENCRYPTION_KEY"] ?? "";

    if (!HEX_64_RE.test(key)) {
      return "Invalid local encryption config: ENCRYPTION_KEY must be 64 hex characters.";
    }

    return null;
  }

  if (provider === "kms") {
    return [
      "dev:fresh does not support KMS-backed local setup.",
      "This command would fail because /api/setup would use AWS KMS to encrypt the OIDC client secret.",
      "For local bootstrap, use ENCRYPTION_PROVIDER=local with a valid ENCRYPTION_KEY.",
    ].join("\n");
  }

  return "No local encryption provider configured. Set ENCRYPTION_PROVIDER=local and provide ENCRYPTION_KEY.";
}
