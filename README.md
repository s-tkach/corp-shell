# Corporate Application Shell

A host web application that serves as the single entry point for all internal corporate tools. Provides SSO via OIDC, role- and subscription-gated navigation, micro-frontend hosting via Module Federation, and a self-contained admin panel — all deployed on AWS via Amplify.

## What it does

- **Single sign-on** — OIDC (PKCE); any OIDC-compliant provider supported without code changes
- **Data-driven navigation** — left sidebar populated entirely from the database, filtered per user's roles and subscription tier
- **Micro-frontend hosting** — child apps deploy independently to S3/CloudFront and register themselves via the Admin Panel; live within 60 seconds, no shell redeploy
- **Admin Panel** — manage menus, roles, users, child apps, subscriptions, SSO config, and branding without engineering involvement
- **First-run wizard** — captures branding, OIDC connection, and the initial super-admin account before the shell goes live

## Stack

| Layer | Technology |
|-------|-----------|
| Shell framework | Next.js 16 (App Router) |
| UI | Shadcn/ui + Tailwind CSS v4 |
| Module Federation | `@module-federation/nextjs-mf` |
| Auth | NextAuth.js v5 + OIDC |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Hosting | AWS Amplify |
| CDN / Static | AWS CloudFront + S3 |
| CI/CD | GitHub Actions |
| Package registry | GitHub Packages |
| Package manager | pnpm workspaces |

## Repository structure

```
corp-shell/
├── src/
│   └── shell/                 # Next.js 16 application
│   ├── app/
│   │   ├── (auth)/            # Login, callback, error routes
│   │   ├── (shell)/           # Protected routes
│   │   │   ├── admin/         # Admin panel (7 sections)
│   │   │   └── [...slug]/     # Child app catch-all mount point
│   │   └── setup/             # First-run wizard (404 after completion)
│   ├── components/
│   │   ├── shell/             # Sidebar, Header, Breadcrumbs, ErrorBoundary
│   │   └── ui/                # Shadcn components
│   └── lib/
│       ├── auth.ts            # NextAuth.js config
│       ├── db/                # Drizzle client, schema, migrations
│       └── mf/                # Module Federation remote loader
├── packages/
│   ├── shell-sdk/             # @corp/shell-sdk — published to GitHub Packages
│   └── create-shell-app/      # @corp/create-shell-app CLI
```

## Getting started

**No AWS account required for local development.**

### Prerequisites

- Node 22 LTS (`nvm install 22 && nvm use 22`)
- pnpm 9.x+ (`npm install -g pnpm`)
- Docker (for local PostgreSQL)
- An OIDC application registered (Web, Authorization Code + PKCE) — only needed to complete the setup wizard

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp src/shell/.env.local.example src/shell/.env.local
```

Edit `src/shell/.env.local` and set:

```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

Leave `ENCRYPTION_PROVIDER=local`, `STORAGE_PROVIDER=local`, and `DATABASE_URL` as-is.

> **No AWS credentials needed.** The local provider encrypts the OIDC client secret with AES-256-GCM instead of KMS, and stores logo uploads to `src/shell/public/uploads/logos/` instead of S3.

### 4. Run database migrations

```bash
pnpm drizzle-kit migrate
```

### 5. Start the dev server

```bash
pnpm --filter shell dev
```

Open `http://localhost:3000` — you are redirected to `/setup`. Complete the 4-step wizard (branding → OIDC connection → super-admin → launch). After completion `/setup` returns 404 permanently.

OIDC redirect URI to register with your provider: `http://localhost:3000/api/auth/callback/oidc`

### Common commands

```bash
pnpm lint           # ESLint
pnpm typecheck      # TypeScript
pnpm --filter shell test   # Vitest unit tests
pnpm --filter shell build  # Production build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor setup.

### AWS / production deployment

To deploy to AWS Amplify, set the following environment variables in the Amplify console instead of `.env.local`:

```
ENCRYPTION_PROVIDER=kms
KMS_KEY_ID=alias/corp-shell-oidc-secret
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=your-logos-bucket-name
AWS_REGION=eu-central-1
DATABASE_URL=<from Secrets Manager or direct>
NEXTAUTH_SECRET=<from Secrets Manager>
WEBHOOK_SECRET=<from Secrets Manager>
```

## First-time deployment

1. Create an S3 bucket and set `AWS_S3_BUCKET` (and optionally `LOGO_CDN_BASE`) in Amplify environment variables
2. Deploy shell via AWS Amplify (manually configured)
3. Visit your domain — you are redirected to `/setup`
4. Complete the 4-step wizard: branding → OIDC connection → super-admin → launch
5. `/setup` returns 404 permanently after completion

## Onboarding a child app

```bash
npx @corp/create-shell-app my-app
```

This scaffolds a React + TypeScript + Webpack 5 project with Module Federation pre-configured, `@corp/shell-sdk` installed, and a GitHub Actions workflow that deploys to S3/CloudFront on push to `main`.

After deploying, register the app in **Admin Panel → Application Registry**. Paste the CloudFront URL, set the route prefix, map routes to sidebar menu items — live for permitted users within 60 seconds.

## Child app SDK

```typescript
import {
  useShellUser,      // { id, email, name, roles, subscriptionTier, subscriptionLevel }
  useShellNavigate,  // shell-aware navigate(path)
  useShellTheme,     // { mode: 'light' | 'dark', primaryColor }
  ShellEventBus,     // emit / on / off
} from '@corp/shell-sdk';
```

## Secrets

Secrets are stored in AWS Secrets Manager or KMS-encrypted in the database — never in source files or `.env` committed to git.

| Secret | Storage | Purpose |
|--------|---------|---------|
| OIDC issuer + client ID | `shell_config` DB row (plaintext) | Read by `lib/auth.ts` at startup |
| OIDC client secret | `shell_config.oidcClientSecret` (KMS-encrypted) | Decrypted at runtime via `lib/kms.ts` |
| `KMS_KEY_ID` | Amplify env / Secrets Manager | AWS KMS key used to encrypt/decrypt OIDC client secret |
| `DATABASE_URL` | Secrets Manager / Amplify env | PostgreSQL connection |
| `NEXTAUTH_SECRET` | Secrets Manager / Amplify env | JWT cookie encryption |
| `WEBHOOK_SECRET` | Secrets Manager / Amplify env | Subscription webhook HMAC-SHA256 |
| `AWS_S3_BUCKET` | Amplify env | S3 bucket for logo uploads |
| `LOGO_CDN_BASE` | Amplify env (optional) | CloudFront base URL for logo delivery — omit to serve from S3 directly |

## Specs

Full product and design documentation lives in `specs/`:

| File | Description |
|------|-------------|
| `specs/PRD.md` | Product requirements, user stories, functional requirements |
| `specs/ARCHITECTURE.md` | System design, component boundaries, data flow |
| `specs/ROADMAP.md` | Milestones and ordered task list |

> No application code is written until the relevant spec exists and is approved. See `CLAUDE.md` for the full spec-driven development workflow.
