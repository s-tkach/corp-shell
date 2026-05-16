#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";

const appName = process.argv[2];

if (!appName || appName.startsWith("-")) {
  console.error("Usage: npx @corp/create-shell-app <app-name>");
  process.exit(1);
}

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

function copyDir(src: string, dest: string, substitutions: Record<string, string>): void {
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
