import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDevFreshCryptoPreflightError,
  parseDevFreshEnv,
} from "./dev-fresh-crypto";
import { getDevFreshPlatformOidcEnv, updateDevFreshEnvValue } from "./dev-fresh-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const shellRoot = resolve(__dirname, "..");
const envFile = resolve(shellRoot, ".env.test.local");
const localEnvFile = resolve(shellRoot, ".env.local");

// ── 1. Load and validate auth bootstrap env ─────────────────────────────────

if (!existsSync(envFile)) {
  console.error(
    `\nMissing ${envFile}\nCopy .env.test.local.example and fill in your OIDC test credentials.\n`
  );
  process.exit(1);
}

const devFreshEnv = parseDevFreshEnv(readFileSync(envFile, "utf8"));
const platformOidcEnv = getDevFreshPlatformOidcEnv(devFreshEnv);

if (!platformOidcEnv) {
  console.error(
    "\nMissing platform OIDC vars in .env.test.local.\nProvide PLATFORM_OIDC_ISSUER / PLATFORM_OIDC_CLIENT_ID / PLATFORM_OIDC_CLIENT_SECRET\nor the legacy SETUP_ISSUER / SETUP_CLIENT_ID / SETUP_CLIENT_SECRET values.\n"
  );
  process.exit(1);
}

if (!existsSync(localEnvFile)) {
  console.error(
    `\nMissing ${localEnvFile}\nCreate .env.local with local encryption settings before running dev:fresh.\n`
  );
  process.exit(1);
}

const localEnv = readFileSync(localEnvFile, "utf8");
const localEnvVars = parseDevFreshEnv(localEnv);
const cryptoPreflightError = getDevFreshCryptoPreflightError(localEnvVars);

if (cryptoPreflightError) {
  console.error(`\n${cryptoPreflightError}\n`);
  process.exit(1);
}

// ── 2. Tear down old container + volume ─────────────────────────────────────

console.log("\n▶ Tearing down existing containers and volumes...");
try {
  execFileSync("docker", ["compose", "down", "-v"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
} catch {
  console.error("\nFailed to run `docker compose down -v`. Is Docker running?");
  process.exit(1);
}

// ── 3. Run migrations via compose ───────────────────────────────────────────

console.log("\n▶ Starting Postgres and running migrations...");
try {
  execFileSync("docker", ["compose", "up", "migrate", "--exit-code-from", "migrate"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
} catch {
  console.error("\nMigration failed. Check the output above.");
  process.exit(1);
}

// ── 4. Rotate the local Auth.js cookie namespace ─────────────────────────────
// A fresh DB needs a new login, but rotating NEXTAUTH_SECRET leaves an existing
// PKCE verifier impossible to decrypt during an in-flight OAuth callback.

console.log("\n▶ Rotating AUTH_COOKIE_NAMESPACE in .env.local...");
const namespace = randomBytes(16).toString("hex");
writeFileSync(
  localEnvFile,
  updateDevFreshEnvValue(localEnv, "AUTH_COOKIE_NAMESPACE", namespace)
);

// ── 5. Start Next.js dev server ──────────────────────────────────────────────

console.log("\n▶ Starting Next.js dev server...");
const nextProcess = spawn("pnpm", ["dev"], {
  cwd: shellRoot,
  env: {
    ...process.env,
    ...platformOidcEnv,
  },
  stdio: "inherit",
});

nextProcess.on("error", (err) => {
  console.error("\nFailed to start Next.js:", err.message);
  process.exit(1);
});

nextProcess.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\nNext.js exited unexpectedly (code ${code})`);
    process.exit(1);
  }
});

function shutdown(code = 0): never {
  nextProcess.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// ── 6. Wait for Next.js to be ready ─────────────────────────────────────────

const APP_URL = "http://localhost:3000";
const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;

async function waitForApp(): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  console.log(`\n▶ Waiting for ${APP_URL} (up to ${TIMEOUT_MS / 1000}s)...`);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(APP_URL, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Next.js did not start within ${TIMEOUT_MS / 1000}s`);
}

// ── 7. Wait for the app and report readiness ────────────────────────────────

async function waitForReady(): Promise<void> {
  await waitForApp();
  console.log(`\n✓ App ready at ${APP_URL}\n`);
}

waitForReady().catch((err) => {
  console.error("\n" + err.message);
  nextProcess.kill();
  process.exit(1);
});
