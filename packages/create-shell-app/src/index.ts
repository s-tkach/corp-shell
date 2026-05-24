#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "./args";

const args = parseArgs(process.argv.slice(2));

const HELP = `
Usage: npx @corp/create-shell-app <command> [options]

Commands:
  init <name>               Provision a new shell host instance
  update [--version X.Y.Z] Update current shell instance to latest (or pinned version)
  new <app-name>            Scaffold a new child app project

Examples:
  npx @corp/create-shell-app init my-corp-shell
  npx @corp/create-shell-app update
  npx @corp/create-shell-app update --version 1.2.0
  npx @corp/create-shell-app new inventory-app
`.trim();

if (args.command === "help") {
  console.log(HELP);
  process.exit(0);
}

if (args.command === "new") {
  runNew(args.name);
} else if (args.command === "init") {
  runInit(args.name);
} else if (args.command === "update") {
  runUpdate(args.version);
}

// ── new ──────────────────────────────────────────────────────────────────────

function runNew(appName: string): void {
  if (!/^[a-z0-9-]+$/.test(appName)) {
    console.error("App name must be lowercase alphanumeric with hyphens only.");
    process.exit(1);
  }

  const destDir = path.resolve(process.cwd(), appName);

  if (fs.existsSync(destDir)) {
    console.error(`Directory '${appName}' already exists.`);
    process.exit(1);
  }

  const templateDir = path.resolve(__dirname, "../template");
  const camelName = appName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

  copyDir(templateDir, destDir, {
    "{{APP_NAME}}": appName,
    "{{APP_CAMEL_NAME}}": camelName,
  });

  console.log(`
Created '${appName}' at ./${appName}

Next steps:
  cd ${appName}
  pnpm install
  pnpm build

Then register the app in the Corp Admin Panel:
  remoteUrl   — the URL where remoteEntry.js is served
  routePrefix — the path the shell will mount this app at
`);
}

// ── init ─────────────────────────────────────────────────────────────────────

function runInit(name: string): void {
  if (!/^[a-z0-9-]+$/.test(name)) {
    console.error("Instance name must be lowercase alphanumeric with hyphens only.");
    process.exit(1);
  }

  const destDir = path.resolve(process.cwd(), name);

  if (fs.existsSync(destDir)) {
    console.error(`Directory '${name}' already exists.`);
    process.exit(1);
  }

  console.log(`Downloading @corp/shell-app from GitHub Packages...`);
  const version = downloadShellApp(destDir, "latest");

  fs.writeFileSync(path.join(destDir, ".shell-version"), version, "utf8");

  console.log(`
Shell instance '${name}' provisioned at ./${name} (version ${version})

Next steps:
  cd ${name}
  cp .env.local.example .env.local
  # Fill in NEXTAUTH_SECRET and ENCRYPTION_KEY:
  #   openssl rand -base64 32  →  NEXTAUTH_SECRET
  #   openssl rand -hex 32     →  ENCRYPTION_KEY
  docker compose up -d
  pnpm install
  pnpm drizzle-kit migrate
  pnpm --filter @corp/shell-app dev
  # Open http://localhost:3000 → complete the setup wizard
`);
}

// ── update ───────────────────────────────────────────────────────────────────

function runUpdate(targetVersion: string | undefined): void {
  const versionFile = path.resolve(process.cwd(), ".shell-version");

  if (!fs.existsSync(versionFile)) {
    console.error(
      "No .shell-version file found. Run this command from the root of a provisioned shell instance."
    );
    process.exit(1);
  }

  const installed = fs.readFileSync(versionFile, "utf8").trim();
  const resolvedTarget = targetVersion ?? "latest";

  console.log(`Updating shell from ${installed} → ${resolvedTarget}...`);
  console.log("Downloading @corp/shell-app from GitHub Packages...");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("node:os") as typeof import("node:os");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-update-"));

  try {
    const newVersion = downloadShellApp(tmpDir, resolvedTarget);

    if (newVersion === installed && !targetVersion) {
      console.log(`Already at latest version (${installed}). Nothing to do.`);
      return;
    }

    const overwritten = overwriteShellFiles(tmpDir, process.cwd());

    fs.writeFileSync(versionFile, newVersion, "utf8");

    console.log(`\nUpdated ${installed} → ${newVersion}`);
    console.log(`\nOverwritten files (${overwritten.length}):`);
    for (const f of overwritten) {
      console.log(`  ${f}`);
    }
    console.log(`
Post-update steps:
  pnpm install
  pnpm drizzle-kit migrate
  # Test locally, then push to redeploy
`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function downloadShellApp(destDir: string, version: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("node:os") as typeof import("node:os");

  const packageSpec =
    version === "latest" ? "@corp/shell-app" : `@corp/shell-app@${version}`;

  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-pack-"));

  try {
    const packOutput = execSync(
      `npm pack ${packageSpec} --registry https://npm.pkg.github.com --pack-destination ${packDir}`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }
    ).trim();

    const tarballName = packOutput.split("\n").pop()?.trim();
    if (!tarballName) throw new Error("npm pack produced no output");
    const tarball = path.join(packDir, tarballName);

    fs.mkdirSync(destDir, { recursive: true });
    execSync(`tar -xzf ${tarball} -C ${destDir} --strip-components=1`, {
      stdio: "inherit",
    });

    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(destDir, "package.json"), "utf8")
    ) as { version: string };

    return pkgJson.version;
  } finally {
    fs.rmSync(packDir, { recursive: true, force: true });
  }
}

function overwriteShellFiles(sourceDir: string, targetDir: string): string[] {
  const overwritten: string[] = [];

  function walk(dir: string, rel: string): void {
    for (const entry of fs.readdirSync(dir)) {
      const srcPath = path.join(dir, entry);
      const relPath = rel ? `${rel}/${entry}` : entry;
      const destPath = path.join(targetDir, relPath);
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, relPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        overwritten.push(relPath);
      }
    }
  }

  walk(sourceDir, "");
  return overwritten;
}

function copyDir(
  src: string,
  dest: string,
  substitutions: Record<string, string>
): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath, substitutions);
    } else {
      let content = fs.readFileSync(srcPath, "utf8");
      for (const [key, value] of Object.entries(substitutions)) {
        content = content.replaceAll(key, value);
      }
      fs.writeFileSync(destPath, content, "utf8");
    }
  }
}
