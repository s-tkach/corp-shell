import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const shellRoot = resolve(__dirname, "..");
const envFile = resolve(shellRoot, ".env.test.local");

// ── 1. Load and validate .env.test.local ────────────────────────────────────

if (!existsSync(envFile)) {
  console.error(
    `\nMissing ${envFile}\nCopy .env.test.local.example and fill in your credentials.\n`
  );
  process.exit(1);
}

function parseEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const env = parseEnvFile(envFile);

const required = ["SETUP_EMAIL", "SETUP_ISSUER", "SETUP_CLIENT_ID", "SETUP_CLIENT_SECRET"];
const missing = required.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error(`\nMissing required vars in .env.test.local:\n  ${missing.join("\n  ")}\n`);
  process.exit(1);
}

// ── 2. Tear down old container + volume ─────────────────────────────────────

console.log("\n▶ Tearing down existing containers and volumes...");
try {
  execFileSync("docker", ["compose", "down", "-v"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
} catch (err) {
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
} catch (err) {
  console.error("\nMigration failed. Check the output above.");
  process.exit(1);
}

// ── 4. Start Next.js dev server ──────────────────────────────────────────────

console.log("\n▶ Starting Next.js dev server...");
const nextProcess = spawn("pnpm", ["dev"], {
  cwd: shellRoot,
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

// ── 5. Wait for Next.js to be ready ─────────────────────────────────────────

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

// ── 6. POST to /api/setup ───────────────────────────────────────────────────

async function runSetup(): Promise<void> {
  await waitForApp();

  console.log("\n▶ Running /api/setup...");
  const res = await fetch(`${APP_URL}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminEmail: env["SETUP_EMAIL"],
      oidcIssuer: env["SETUP_ISSUER"],
      oidcClientId: env["SETUP_CLIENT_ID"],
      oidcClientSecret: env["SETUP_CLIENT_SECRET"],
      scopes: "openid profile email",
      tokenEndpointAuthMethod: "client_secret_post",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`\n/api/setup failed (${res.status}):\n${body}\n`);
    nextProcess.kill();
    process.exit(1);
  }

  console.log(`\n✓ Setup complete. App ready at ${APP_URL}\n`);
}

runSetup().catch((err) => {
  console.error("\n" + err.message);
  nextProcess.kill();
  process.exit(1);
});
