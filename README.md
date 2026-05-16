# Corporate Application Shell

A host web application that serves as the single entry point for all internal corporate tools. Provides SSO via Okta OIDC, role- and subscription-gated navigation, micro-frontend hosting via Module Federation, and a self-contained admin panel — all deployed serverlessly on AWS via SST v3.

## What it does

- **Single sign-on** — Okta OIDC (PKCE); extensible to any future OIDC provider without code changes
- **Data-driven navigation** — left sidebar populated entirely from the database, filtered per user's roles and subscription tier
- **Micro-frontend hosting** — child apps deploy independently to S3/CloudFront and register themselves via the Admin Panel; live within 60 seconds, no shell redeploy
- **Admin Panel** — manage menus, roles, users, child apps, subscriptions, SSO config, and branding without engineering involvement
- **First-run wizard** — captures branding, Okta connection, and the initial super-admin account before the shell goes live

## Stack

| Layer | Technology |
|-------|-----------|
| Shell framework | Next.js 15 (App Router) |
| UI | Shadcn/ui + Tailwind CSS v4 |
| Module Federation | `@module-federation/nextjs-mf` |
| Auth | NextAuth.js v5 + Okta OIDC |
| ORM | Drizzle ORM |
| Database | Aurora Serverless v2 (PostgreSQL) |
| Compute | AWS Lambda via SST v3 |
| CDN / Static | AWS CloudFront + S3 |
| IaC | SST v3 (Ion) |
| CI/CD | GitHub Actions |
| Package registry | GitHub Packages |
| Package manager | pnpm workspaces |

## Repository structure

```
aws-corp-shell-app/
├── sst.config.ts              # All AWS resource definitions
├── shell/                     # Next.js 15 application
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
└── stacks/
    └── child-app-stack.ts     # Reusable SST stack for child app S3+CloudFront
```

## Getting started

### Prerequisites

- Node 20 LTS (enforced — `package.json` rejects other major versions)
- pnpm 9.x+
- Docker (for local PostgreSQL)
- AWS CLI + credentials configured
- An Okta application registered (Web, OIDC, Authorization Code + PKCE)

#### Install Node 20 via nvm

```bash
nvm install 20
nvm use 20
```

#### Install AWS CLI (macOS)

```bash
brew install awscli
aws configure   # enter Access Key ID, Secret, region, output format
```

### Install dependencies

```bash
pnpm install
```

### Start a local database

```bash
docker run -d \
  --name shell-pg \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=shell_dev \
  -p 5432:5432 \
  postgres:15
```

### Create local env file

Create `shell/.env.local` (gitignored — never commit):

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Okta OIDC
OKTA_CLIENT_ID=<from Okta app>
OKTA_CLIENT_SECRET=<from Okta app>
OKTA_ISSUER=https://<your-okta-domain>/oauth2/default

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/shell_dev

# Webhook (any random string locally)
WEBHOOK_SECRET=<openssl rand -base64 32>
```

Okta redirect URI to register: `http://localhost:3000/api/auth/callback/okta`

### Run database migrations

```bash
pnpm drizzle-kit migrate
```

### Development

```bash
pnpm --filter shell dev
```

Shell runs at `http://localhost:3000`. On first visit you are redirected to `/setup` — complete the 4-step wizard (branding → Okta → super-admin → launch). After completion `/setup` returns 404 permanently.

### Common commands

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Build shell for production
pnpm --filter shell build

# Deploy to AWS
npx sst deploy --stage dev
npx sst deploy --stage prod
```

## First-time deployment

1. Run `npx sst deploy --stage prod`
2. Visit your domain — you are redirected to `/setup`
3. Complete the 4-step wizard: branding → Okta connection → super-admin → launch
4. `/setup` returns 404 permanently after completion

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

All secrets are stored in AWS Secrets Manager — never in source files or `.env` committed to git.

| Secret | Purpose |
|--------|---------|
| `OKTA_CLIENT_SECRET` | Okta OIDC |
| `OKTA_CLIENT_ID` | Okta OIDC |
| `DATABASE_URL` | Aurora connection |
| `NEXTAUTH_SECRET` | JWT cookie encryption |
| `WEBHOOK_SECRET` | Subscription webhook HMAC-SHA256 |

## Specs

Full product and design documentation lives in `specs/`:

| File | Description |
|------|-------------|
| `specs/PRD.md` | Product requirements, user stories, functional requirements |
| `specs/ARCHITECTURE.md` | System design, component boundaries, data flow |
| `specs/ROADMAP.md` | Milestones and ordered task list |

> No application code is written until the relevant spec exists and is approved. See `CLAUDE.md` for the full spec-driven development workflow.
