# Architecture Design: Corporate Application Shell
**Version:** 1.1 (v1 current) / 2.0 (v2 planned)  
**Status:** v1 implemented; v2 documented ahead of implementation  
**Date:** 2026-05-24  
**PRD Reference:** `specs/PRD.md` v2.0  
**Changelog:** v2.0 — Added §20 (v2 Multi-Tenant Architecture design, not yet implemented). v1.1 — Added §10.3 (local dev prerequisites), §17 (CryptoProvider abstraction), §18 (StorageProvider abstraction), §19 (OSS repo infrastructure); updated §3, §4.1, §10.1, §10.2, §12, §14.

> **Sections §1–§19 describe the current v1 implementation (M1–M15).** Section §20 is the v2 design addendum (M16–M19, planned).

---

## 1. Overview

The Corporate Application Shell is a **Next.js 15 monorepo** deployed on AWS via Amplify (manually configured). It acts as a host for independently deployed micro-frontends (Module Federation), provides SSO via OIDC, and exposes an admin panel for all runtime configuration. There is no separate backend service — Next.js API routes serve as the API layer.

---

## 2. Repository Structure

```
corp-shell/                          ← monorepo root (also the @corp/shell-app source)
├── .shell-version                   # Installed shell version (written by create-shell-app init/update)
├── package.json                     # Workspace root (pnpm workspaces)
├── src/
│   └── shell/                       # Next.js 15 application — published as @corp/shell-app
│   ├── app/
│   │   ├── layout.tsx               # Root layout (Server Component): auth, menu, sidebar
│   │   ├── (auth)/                  # /login, /api/auth/callback, /error
│   │   ├── (shell)/                 # Protected routes (require valid session)
│   │   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   │   ├── menu/
│   │   │   │   ├── roles/
│   │   │   │   ├── users/
│   │   │   │   ├── apps/
│   │   │   │   ├── subscriptions/
│   │   │   │   ├── sso/
│   │   │   │   ├── branding/
│   │   │   │   └── notifications/
│   │   │   └── [...slug]/           # Child app catch-all (Client Component)
│   │   └── setup/                   # First-run wizard (404 after completion)
│   ├── api/
│   │   ├── auth/[...nextauth]/      # NextAuth.js v5 handler
│   │   ├── menu/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── apps/
│   │   ├── subscriptions/
│   │   ├── notifications/           # GET list, POST read, GET SSE stream
│   │   ├── admin/
│   │   │   └── notifications/       # GET list, POST create, DELETE [id]
│   │   └── internal/
│   │       ├── webhooks/            # Payment provider webhook (HMAC-SHA256)
│   │       └── notifications/       # POST from SDK (HMAC-SHA256)
│   ├── components/
│   │   ├── shell/                   # Sidebar, Header, Breadcrumbs, ErrorBoundary, AppSkeleton
│   │   │   └── notifications/       # NotificationBell, NotificationDropdown, NotificationToast, NotificationProvider
│   │   └── ui/                      # Shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth.js config + OIDC provider
│   │   ├── db/
│   │   │   ├── client.ts            # Drizzle ORM client (serverless pg)
│   │   │   ├── schema.ts            # All table definitions
│   │   │   └── migrations/          # Drizzle migration files
│   │   └── mf/
│   │       └── router.ts            # MF remote resolution by route prefix
│   └── middleware.ts                # Auth gate + RBAC guard (runs on every request)
├── packages/
│   ├── shell-sdk/                   # @corp/shell-sdk — published to GitHub Packages
│   │   ├── src/
│   │   │   ├── hooks/               # useShellUser, useShellNavigate, useShellTheme
│   │   │   ├── events/              # ShellEventBus
│   │   │   └── tailwind/            # Shared design token preset
│   │   └── package.json
│   └── create-shell-app/            # @corp/create-shell-app CLI (init, update, new subcommands)
│       ├── src/
│       │   └── index.ts             # CLI entry: routes init / update / new subcommands
│       └── template/                # Child app project template
```

---

## 3. Technology Stack

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Shell framework | Next.js App Router | 15.x | SSR for layout/auth; API routes as backend |
| UI components | Shadcn/ui + Tailwind CSS | v4 | Forked from `satnaing/shadcn-admin` |
| Module Federation | `@module-federation/nextjs-mf` | latest | MF core team maintained |
| Authentication | NextAuth.js (Auth.js) | v5 | Generic OIDC; httpOnly JWT session cookie |
| Client state | Zustand | 4.x | Shell UI state only (sidebar collapse, theme) |
| ORM | Drizzle ORM | latest | Type-safe; no persistent connection pool |
| Database | PostgreSQL | 15.x | Scales to zero in dev; single DB for all shell data |
| Compute | AWS Amplify | — | Hosts Next.js app; manually configured outside repo |
| CDN / Static | AWS CloudFront + S3 | — | Shell assets + child app remoteEntry files |
| DNS / TLS | Amazon Route 53 + ACM | — | Custom domain, auto-renewing SSL |
| Secrets | AWS Secrets Manager + AWS KMS | — | Webhook HMAC key, DB URL (Secrets Manager for production / plain env vars for local); OIDC client secret encrypted in DB via configurable crypto provider (KMS in prod, AES-256-GCM locally via `ENCRYPTION_PROVIDER` env var) |
| File storage | S3 or local disk | — | Logo uploads; `STORAGE_PROVIDER=s3\|local`; defaults to `local` when `AWS_S3_BUCKET` is absent |
| Unit/integration tests | Vitest | latest | `crypto.ts`, `auth.ts`, `middleware.ts`, setup-complete route |
| CI/CD | GitHub Actions | — | Child apps deploy independently; shell via Amplify |
| Package registry | GitHub Packages | — | `@corp/shell-sdk`, `@corp/create-shell-app` |
| Package manager | pnpm workspaces | 9.x | Monorepo; shared lockfile |

---

## 4. System Architecture

### 4.1 High-Level Topology

```
Browser
  │
  │  HTTPS (app.corp.com)
  ▼
Route 53 ──→ CloudFront (shell distribution)
                │
                ├──→ Lambda@Edge          Next.js SSR + API routes
                │      │
                │      │  Drizzle ORM / pg (private VPC)
                │      ▼
                │    PostgreSQL
                │
                └──→ S3 (shell static assets: _next/static/*)

                CloudFront (child app distributions — one per app)
                  └──→ S3 prefix  s3://corp-child-apps/{app-name}/
                         remoteEntry.js + chunk assets

  OIDC (PKCE)
  │
  ▼
OIDC Provider (any OIDC-compliant issuer)
  Authorization Server + groups claim + RP-Initiated Logout

AWS Secrets Manager
  WEBHOOK_SECRET, DATABASE_URL
AWS KMS
  Encrypts OIDC client secret stored in shell_config DB row

GitHub Packages
  @corp/shell-sdk, @corp/create-shell-app
```

**Local / self-hosted topology:** Browser → `localhost:3000` (Next.js dev server) → PostgreSQL (Docker Compose, port 5432). No Route 53, CloudFront, Lambda, or Amplify layers exist. KMS is replaced by the local AES-256-GCM provider in `lib/crypto.ts`. S3 is replaced by the local disk provider in `lib/storage.ts`. Secrets Manager is replaced by values in `src/shell/.env.local`.

### 4.2 Request Lifecycle

```
1. Browser → CloudFront → Lambda (Next.js middleware.ts)
2. middleware.ts:
     a. /setup  → if shell_config.setup_complete: return 404
     b. all other routes: check NextAuth.js session cookie
        - No session → redirect /api/auth/signin (OIDC provider)
        - Session valid → check route RBAC
          - Unauthorized → 403 page
          - Authorized → continue
3. Server Component (layout.tsx):
     - auth() reads session (no DB hit — JWT cookie)
     - fetch menu from DB, filter by roles + subscriptionLevel
     - render Sidebar + Header (server HTML)
4. Client Component ([...slug]/page.tsx):
     - useShellRouting() → resolves MF remote by route prefix
     - React.lazy + dynamic import() loads child AppEntry
     - ErrorBoundary catches any child crash
5. API routes (/api/**):
     - Re-validate session on every mutating request
     - Admin routes additionally assert super_admin or admin role
```

---

## 5. Component Boundaries

### 5.1 Server vs. Client Split

```
Server Components (no JS bundle cost)        Client Components ("use client")
────────────────────────────────────         ───────────────────────────────
RootLayout                                   ContentArea (MF mount point)
  ├─ auth session check                        └─ useShellRouting()
  ├─ menu fetch + filter                           └─ dynamic import() → AppEntry
  ├─ Sidebar (static render)                   Sidebar collapse toggle (Zustand)
  └─ Header (static render)                    Theme toggle (Zustand)
                                               Admin Panel forms (all CRUD)
                                               Platform admin tenant management
```

### 5.2 Shell ↔ Child App Contract

The shell owns layout, auth, and navigation. Child apps own their feature content. The boundary is the `AppEntry` component.

**Child app must:**
- Export a default `AppEntry(): JSX.Element` from its MF config
- Be a React Client Component
- Not import Next.js-specific APIs (`next/navigation`, `next/image`, etc.)
- Use `@corp/shell-sdk` for user context, navigation, and theme

**Shell guarantees to child apps:**
- `ShellSDKProvider` wraps `AppEntry` — all SDK hooks are available
- `useShellUser()` returns `{ id, email, name, roles, subscriptionTier, subscriptionLevel }`
- `useShellNavigate()` triggers shell-level route changes
- `useShellTheme()` returns `{ mode, primaryColor }`
- `ShellEventBus` for cross-app events

**Child app manifest (`{remoteUrl}/mf-manifest.json`):**
```typescript
interface ChildAppManifest {
  name: string;         // MF remote name, e.g. "inventoryApp" — globally unique
  version: string;      // Semver
  routePrefix: string;  // e.g. "/inventory" — globally unique, registered in Admin Panel
  routes: {
    path: string;       // Relative to routePrefix
    label: string;      // Used for breadcrumbs
  }[];
}
```

---

## 6. Authentication & Session Architecture

### 6.1 Flow (OIDC + PKCE via NextAuth.js v5)

```
User → middleware (no session) → NextAuth redirect to OIDC provider
  → OIDC login → callback /api/auth/callback/oidc
  → NextAuth jwt() callback:
      1. Extract groups[] from ID token
      2. DB: map IDP groups → shell roles  (idp_group_role_mappings)
      3. DB: get subscription tier          (user_subscriptions)
      4. New user? JIT-provision:
           INSERT users
           INSERT user_roles (from group mappings)
           INSERT user_subscriptions (free tier)
      5. Write auth_events (LOGIN)
      6. Embed { userId, roles, subscriptionTier, subscriptionLevel } in JWT
  → Encrypted JWT written to httpOnly Secure SameSite=Lax cookie
  → Redirect to originally requested URL
```

### 6.2 Session Storage Rules

| Storage | Used | Reason |
|---------|------|--------|
| `httpOnly` cookie (encrypted JWT) | Yes | Tokens inaccessible to JS; XSS-safe |
| `localStorage` / `sessionStorage` | Never | XSS attack surface |
| Server-side session store (Redis) | Never | Not needed at ≤1,000 users; stateless Lambda |

### 6.3 Token Refresh & Logout

- **Refresh:** NextAuth.js handles silently; user is never redirected while session is valid.
- **Logout:** `signOut()` → clears local cookie → OIDC RP-Initiated Logout ends the provider session.

### 6.4 Future IDP Extensibility

Adding Azure AD or Google Workspace requires:
1. Add a new NextAuth.js provider entry in `lib/auth.ts`
2. Store the new provider's client ID and KMS-encrypted client secret in `shell_config` (or a new `idp_config` table for multi-provider support)
3. No structural code changes to the auth flow

---

## 7. Authorization (RBAC)

### 7.1 Enforcement Layers

```
Layer 1 — middleware.ts      (edge, every request)
  Check: session exists + route not blocked by RBAC
  Result: 401 redirect or 403 page before any page code runs

Layer 2 — API route handlers  (server, every mutating call)
  Check: session roles against required roles for that endpoint
  Result: 403 JSON response — never trust client-side role state alone

Layer 3 — Server Component    (layout, menu render)
  Check: filter menu items by session.roles + session.subscriptionLevel
  Result: user only sees nav items they are entitled to
```

### 7.2 Role Model

- Roles are **slugs** defined in the shell DB (e.g. `finance_manager`), not IDP group names.
- IDP groups → shell roles are mapped in `idp_group_role_mappings` table.
- Mapping applied in NextAuth.js `jwt()` callback on **every login** (groups refreshed each session).
- `super_admin` is a system role: `isSystem = true`, cannot be deleted or renamed.
- Users may hold multiple roles; effective access = union of all role permissions.

### 7.3 Subscription Entitlement

- Each user has a `subscriptionTier` (e.g. `free`) and numeric `subscriptionLevel` (0/1/2).
- Both embedded in session JWT — no per-route DB call.
- Menu items declare `requiredSubLevel`; shell filters at render time.
- Users below required level → Upgrade Prompt page (admin-configured content).
- `subscriptionExpiresAt` → downgrade to `free` on next login.

---

## 8. Module Federation Architecture

### 8.1 Shell as Host

```typescript
// shell/next.config.ts
new NextFederationPlugin({
  name: 'shell',
  remotes,          // loaded from DB via API, TTL 60s
  shared: {
    react:             { singleton: true, requiredVersion: '^18' },
    'react-dom':       { singleton: true, requiredVersion: '^18' },
    '@corp/shell-sdk': { singleton: true },
  },
})
```

- Remotes are fetched from the DB (app_registry table) at shell startup and cached 60 seconds.
- New child app registered in Admin Panel → live for permitted users within 60 seconds, no shell redeploy.
- All MF dynamic imports use `ssr: false` — remotes are client-side only.

### 8.2 Route Resolution

```
URL: /inventory/orders/123
  ↓
useShellRouting() scans app_registry for longest matching routePrefix
  → matches routePrefix = "/inventory"  (inventoryApp remote)
  ↓
dynamic import('inventoryApp/AppEntry')
  ↓
<ErrorBoundary> + <Suspense fallback={<AppSkeleton />}>
  <AppEntry />   ← child app renders here
```

### 8.3 Error Isolation

Every child app mount is wrapped in a React `ErrorBoundary`. A crash or unreachable remote shows a scoped error view for that route only — the sidebar, header, and other shell routes are unaffected.

### 8.4 Child App Hosting (Single AWS Account)

```
Child app CI (GitHub Actions):
  build → s3 sync → s3://corp-child-apps/{app-name}/ → CloudFront invalidation

CloudFront distribution per child app:
  Origin: s3://corp-child-apps/{app-name}/
  Output URL: https://{distro-id}.cloudfront.net

Admin Panel → Application Registry:
  remoteUrl = https://{distro-id}.cloudfront.net
  routePrefix = /inventory
```

---

## 9. Database Architecture

### 9.1 Engine & Connection

- **Engine:** PostgreSQL 15, private VPC subnet.
- **Connection:** Drizzle ORM with `@neondatabase/serverless` or `postgres` (non-pooling) driver — safe for Lambda cold starts, no persistent connection pool.
- **Credentials:** `DATABASE_URL` stored in Secrets Manager; injected as an Amplify environment variable.

### 9.2 Schema Overview

| Table | Purpose |
|-------|---------|
| `users` | JIT-provisioned user records (email, idpSource, idpSubject, isActive) |
| `roles` | Role definitions (slug, displayName, isSystem) |
| `user_roles` | Many-to-many: users ↔ roles |
| `idp_group_role_mappings` | IDP group name → shell role slug |
| `subscription_tiers` | Tier definitions (id, displayName, level, upgradeCta, upgradeUrl) |
| `user_subscriptions` | User → tier assignment with optional expiry |
| `menu_sections` | Top-level nav groupings (label, icon, sortOrder) |
| `menu_items` | Nav leaf items (route, requiredRoles[], requiredSubLevel, badge) |
| `app_registry` | Registered child apps (remoteUrl, routePrefix, healthCheckUrl) |
| `shell_config` | Single-row: branding, OIDC issuer + client ID + KMS-encrypted client secret, setup_complete flag |
| `auth_events` | Login/logout/failure events (viewer UI in v2) |
| `notifications` | Notification records with title, body, targeting (all/user/subscription), optional action, optional expiry |
| `notification_reads` | Per-user read state junction table (notificationId + userId) |

### 9.3 Migrations

Managed by Drizzle Kit. Migration files live in `src/shell/lib/db/migrations/`. Applied manually or as part of the CI pipeline before traffic shifts.

---

## 10. Infrastructure (AWS Amplify)

The shell is hosted on AWS Amplify (manually configured outside the repo). Amplify manages the Next.js compute, CloudFront CDN, and custom domain. PostgreSQL, Secrets Manager, and Route 53 are provisioned separately.

### 10.1 Secrets

| Secret | Storage | Consumed By |
|--------|---------|------------|
| OIDC issuer + client ID | `shell_config` DB row (plaintext) | `lib/auth.ts` (`getOidcConfig()`) |
| OIDC client secret | `shell_config.oidcClientSecret` (encrypted ciphertext) | `lib/auth.ts` via `decrypt()` from `lib/crypto.ts` (provider selected by `ENCRYPTION_PROVIDER`) |
| `ENCRYPTION_PROVIDER` | Env var | `lib/crypto.ts` — `kms` uses `KMS_KEY_ID`; `local` uses `ENCRYPTION_KEY`; defaults to `local` when `KMS_KEY_ID` is absent |
| `ENCRYPTION_KEY` | `.env.local` / Amplify env | `lib/crypto.ts` local provider (64 hex chars = 32 bytes; required when `ENCRYPTION_PROVIDER=local`) |
| `KMS_KEY_ID` | Amplify env | `lib/kms.ts` / `lib/crypto.ts` KMS provider (required when `ENCRYPTION_PROVIDER=kms`) |
| `DATABASE_URL` | Secrets Manager / Amplify env / `.env.local` | Next.js (Drizzle ORM); plain env var for local dev, Secrets Manager optional for Amplify production |
| `NEXTAUTH_SECRET` | Secrets Manager / Amplify env / `.env.local` | Next.js (NextAuth.js JWT encryption); plain env var for local dev, Secrets Manager optional for Amplify production |
| `WEBHOOK_SECRET` | Secrets Manager / Amplify env | Next.js (HMAC-SHA256 webhook validation) |
| `AWS_S3_BUCKET` | Amplify env / optional | `lib/storage.ts` S3 provider; if absent, local disk provider is used automatically |
| `STORAGE_PROVIDER` | Env var / optional | `lib/storage.ts` — `s3` or `local`; defaults to `local` when `AWS_S3_BUCKET` is absent |
| `LOGO_CDN_BASE` | Amplify env / optional | CDN base URL for S3-stored logos; omit for local dev |
| `AWS_REGION` | Amplify env (auto-set by Amplify) | Next.js (S3Client, KMSClient region); not required when using local providers |

All secrets configured in Amplify environment variables — never in source files or `.env` committed to git. For local dev, values go in `src/shell/.env.local` (gitignored).

### 10.2 S3 Logo Bucket

A dedicated S3 bucket stores uploaded logo images. The shell generates a presigned PUT URL server-side (`POST /api/admin/branding`) and the browser uploads directly to S3.

**Required setup:**
1. Create an S3 bucket (e.g. `corp-shell-logos-<account-id>`).
2. Block all public access on the bucket.
3. Attach a bucket policy granting the Amplify execution role `s3:PutObject` on `logos/*`.
4. Set `LOGO_BUCKET=<bucket-name>` as an Amplify environment variable.
5. For local dev, add the following to `src/shell/.env.local` (not committed):
   ```
   LOGO_BUCKET=<bucket-name>
   AWS_REGION=<region>
   AWS_ACCESS_KEY_ID=<key-id>
   AWS_SECRET_ACCESS_KEY=<secret>
   ```
   The IAM user/role used locally must have `s3:PutObject` on `<bucket-name>/logos/*`.

The `logoUrl` stored in `shell_config` should be the public CloudFront URL (not the direct S3 URL) so the logo is served via CDN.

**Local / self-hosted alternative:** Set `STORAGE_PROVIDER=local` (or omit `AWS_S3_BUCKET`). The upload route writes files to `public/uploads/logos/<filename>` on the Next.js server and returns a relative URL. No S3 bucket or presigned URL is involved. `public/uploads/` is `.gitignore`d; `public/uploads/.gitkeep` preserves the directory in the repo.

### 10.3 Local Development Prerequisites

The following are sufficient to run the shell without any AWS account:

| Prerequisite | Why | How |
|---|---|---|
| Docker / Docker Compose | Local PostgreSQL | `docker compose up -d` (docker-compose.yml at repo root) |
| `NEXTAUTH_SECRET` | NextAuth.js JWT encryption | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Local AES-256-GCM for OIDC client secret | `openssl rand -hex 32` |
| OIDC provider (any) | Authentication | Any OIDC-compliant issuer; Okta, Keycloak, Auth0, or a local OIDC mock |

AWS env vars (`AWS_REGION`, `KMS_KEY_ID`, `AWS_S3_BUCKET`) are all optional. Omitting them activates the local providers automatically.

---

## 11. CI/CD

### 11.1 Shell Pipeline

Shell deployment is handled by **AWS Amplify** (connected to the `main` branch). Amplify automatically builds and deploys on push. Database migrations are run manually or via a separate CI step before deploying:

```
pnpm drizzle-kit migrate   (apply pending migrations)
  ↓
Amplify auto-deploys on push to main
```

### 11.2 Child App Pipeline (scaffolded by CLI)

```
on: push to main
  ↓
pnpm install + pnpm build (webpack MF build)
  ↓
aws s3 sync dist/ s3://corp-child-apps/{app-name}/
  ↓
aws cloudfront create-invalidation
```

### 11.3 SDK & CLI Publish Pipelines

**SDK** (trigger: tag `shell-sdk/v*.*.*`):
```
pnpm --filter shell-sdk build
  ↓
npm publish --access restricted → @corp/shell-sdk on GitHub Packages
```

**CLI** (trigger: tag `create-shell-app/v*.*.*`):
```
pnpm --filter create-shell-app build
  ↓
npm publish --access restricted → @corp/create-shell-app on GitHub Packages
```

### 11.4 Shell App Publish Pipeline

Trigger: tag `shell-app/vX.Y.Z` pushed to `main`.

```
pnpm --filter shell build    # Next.js production build (validates the source compiles)
  ↓
npm publish --access restricted → @corp/shell-app on GitHub Packages
  (files: app/, components/, lib/, public/, middleware.ts, next.config.ts, etc.
   — full source tree, not the compiled .next output)
```

The published package contains raw TypeScript/TSX source. Consumers receive the source tree, not a compiled bundle — each instance runs its own `next build` in its own deployment environment.

---

## 12. Security Architecture

| Concern | Mitigation |
|---------|-----------|
| Session tokens | `httpOnly` encrypted JWT cookie only; never `localStorage` |
| CSRF | NextAuth.js built-in CSRF token on all state-mutating API routes |
| Admin route bypass | Server-side role check in every API handler + middleware — no client-only guard |
| Webhook forgery | HMAC-SHA256 with `WEBHOOK_SECRET` from Secrets Manager; constant-time compare |
| Secret leakage | Secrets in Secrets Manager or KMS-encrypted in DB; zero secrets in source or git history |
| Crypto provider fallback | Local AES-256-GCM provider uses `randomBytes(16)` per-value IV; output prefixed `local:<iv>:<ct>:<tag>` to distinguish from KMS blobs; key rotation requires re-encryption of stored secrets |
| XSS | Shadcn/ui + React; no `dangerouslySetInnerHTML`; CSP header via CloudFront |
| Child app crash | React ErrorBoundary per child app mount; shell unaffected |
| OIDC misconfiguration | Platform admin validates OIDC discovery endpoint during tenant creation |
| Lockout prevention | `super_admin` role is system-owned and auto-assigned to the first platform user |

---

## 13. Observability

| Signal | Implementation |
|--------|---------------|
| Structured logs | `console.log(JSON.stringify({...}))` → CloudWatch Logs (Lambda auto-captures) |
| Request tracing | Next.js `instrumentation.ts` with OpenTelemetry; trace IDs in every log line |
| Auth events | Written to `auth_events` table on login/logout/failure/JIT-provision |
| Child app health | Admin Panel pings each `healthCheckUrl` from `app_registry`; last healthy timestamp stored |
| Performance | CloudWatch RUM for shell load time (P95 target: <2s) and MF child load (P95: <1.5s) |
| Cost | AWS Cost Explorer tagged by `project=corp-shell` |

---

## 14. First-Run Wizard Architecture

The wizard is a self-contained flow at `/setup`. It is the only route reachable before `shell_config.setup_complete = true`.

```
middleware.ts:
  if (!shell_config.setup_complete && path !== '/setup'):
    redirect('/setup')
  if (shell_config.setup_complete && path === '/setup'):
    return 404

Wizard state: React local state only (not persisted until Step 4 "Launch")

Step 1 — Branding:   POST /api/setup/upload-logo → StorageProvider (S3 presigned PUT when STORAGE_PROVIDER=s3; direct multipart POST to local disk when STORAGE_PROVIDER=local)
Step 2 — OIDC:       GET /api/setup/validate-oidc → pings /.well-known/openid-configuration
Step 3 — Super Admin: triggers full OIDC login inline; verifies returned email matches input
Step 4 — Launch:     POST /api/setup/complete →
                       INSERT shell_config
                       INSERT subscription_tiers (free/standard/enterprise defaults)
                       INSERT roles (super_admin, admin defaults)
                       INSERT users (super admin)
                       INSERT user_roles
                       INSERT user_subscriptions (enterprise, no expiry)
                       SET shell_config.setup_complete = true
                     → redirect /dashboard
```

---

## 15. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| No separate backend | Next.js API routes | Reduces operational surface; Lambda scales to zero |
| No Redis / session store | Stateless JWT cookie | ≤1,000 users; Lambda ephemeral; no sticky sessions needed |
| Module Federation over iFrame | MF (v1) | Shared React context, SDK hooks, and design colors; iFrame in v2 |
| PostgreSQL over DynamoDB | PostgreSQL | RBAC, menu, and admin queries are relational; Drizzle ORM type safety |
| Single AWS account | One account | Simplified IAM, networking, and cost tracking for v1 |
| Fork over build from scratch | `satnaing/shadcn-admin` | Sidebar, header, Shadcn wiring already done; focus on domain logic |
| GitHub Packages over npm | GitHub Packages | Org-private packages; GITHUB_TOKEN auth in Actions without extra secrets |
| AWS Amplify over CDK/SAM | Amplify | First-class Next.js support; managed hosting; no IaC config in repo |

---

## 16. Notifications Architecture

### 16.1 Data Model

**`notifications` table**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | defaultRandom() |
| `title` | text NOT NULL | Short headline |
| `body` | text | Optional description |
| `actionLabel` | text | e.g. "View details" |
| `actionType` | text | `"url"` or `"download"` |
| `actionPayload` | text | URL for both action types |
| `targetType` | text NOT NULL | `"all"` \| `"user"` \| `"subscription"` |
| `targetUserId` | uuid FK → users | Set when `targetType = "user"` |
| `targetSubLevel` | integer | Min subscription level required when `targetType = "subscription"` |
| `expiresAt` | timestamp with tz | Nullable; hidden after this time |
| `createdBy` | uuid FK → users | Admin or SDK caller |
| `createdAt` | timestamp with tz | defaultNow() |

**`notification_reads` table**

| Column | Type | Notes |
|--------|------|-------|
| `notificationId` | uuid FK → notifications (cascade delete) | |
| `userId` | uuid FK → users (cascade delete) | |
| `readAt` | timestamp with tz | defaultNow() |

Primary key: `(notificationId, userId)`

**Visibility logic** — a notification is visible to a user if:
1. `expiresAt` is null OR `expiresAt > now()`
2. One of: `targetType = "all"` / `targetType = "user" AND targetUserId = currentUserId` / `targetType = "subscription" AND userSubLevel >= targetSubLevel`

### 16.2 API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | session | Paginated visible notifications for current user, with read state |
| POST | `/api/notifications` | session | Create a notification; usable by any authenticated user including child apps (browser fetch with session cookie); `createdBy` set from session |
| POST | `/api/notifications/read` | session | Mark one or all as read; body: `{ notificationId: string \| "all" }` |
| GET | `/api/notifications/stream` | session | SSE stream; pushes events when new notifications arrive |
| GET | `/api/admin/notifications` | admin role | List all notifications with read counts |
| POST | `/api/admin/notifications` | admin role | Create a notification (admin UI path) |
| DELETE | `/api/admin/notifications/[id]` | admin role | Hard delete notification and its read records |

### 16.3 UI Components

**`NotificationProvider`** (`components/shell/notifications/notification-provider.tsx`)
- Client component wrapping the shell layout
- Opens SSE connection to `/api/notifications/stream` on mount; reconnects with exponential backoff (1s → 2s → 4s … max 30s)
- On SSE event: adds toast, increments Zustand `unreadCount`
- Exposes `useNotifications()` hook: `{ notifications, unreadCount, markRead, markAllRead, refresh }`

**`NotificationBell`** (`components/shell/notifications/notification-bell.tsx`)
- Replaces `<div data-shell-notifications />` in `header.tsx`
- Ghost icon button with `Bell` (lucide-react); absolute-positioned red badge; hidden when count is 0; capped at `99+`
- Opens `NotificationDropdown` via `DropdownMenu`

**`NotificationDropdown`** (`components/shell/notifications/notification-dropdown.tsx`)
- 320px wide, max-height 480px with scroll
- Header: "Notifications" title + "Mark all read" link
- All / Unread tabs (client-side filter)
- Per-row: dot indicator, title, body (2-line truncation), relative timestamp, optional action link
- Clicking a row marks it read

**`NotificationToast`** (`components/shell/notifications/notification-toast.tsx`)
- Bottom-right, stacks upward; max 3 simultaneous; oldest dismissed when 4th arrives
- Content: bell icon, title, body (truncated), optional action link, × dismiss button
- Auto-dismisses after 5 seconds

### 16.4 Zustand Store Additions

Added to `shell/lib/store/shell-store.ts`:

```ts
unreadCount: number
setUnreadCount: (n: number) => void
incrementUnreadCount: () => void
```

### 16.5 SSE Delivery

- Response: `Content-Type: text/event-stream`, `ReadableStream`
- In-process registry: `Map<userId, Set<ReadableStreamDefaultController>>` keyed by userId; a separate `Set<ReadableStreamDefaultController>` holds connections for subscription-level notifications checked at connection time
- On new notification: iterate eligible controllers based on `targetType`:
  - `"all"` — push to all active connections
  - `"user"` — push to the target user's controllers only
  - `"subscription"` — push to connections where the stored subscription level satisfies the threshold
- 30-second `": ping"` comment to keep connections alive through proxies

### 16.6 Child App Notification Push

Child apps push notifications by calling `POST /api/notifications` directly from the browser using the existing SSO session cookie. No additional secret, SDK method, or HMAC signing is required. The session cookie is `httpOnly` and sent automatically on same-origin requests.

```ts
// Inside any child app React component
await fetch('/api/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Export complete',
    targetType: 'user',
    targetUserId: currentUserId,
  }),
});
```

`createdBy` is set server-side from the session. All three targeting modes (`all`, `user`, `subscription`) are available to any authenticated caller.

---

## 17. CryptoProvider Abstraction

### 17.1 Interface

`shell/lib/crypto.ts` exports a `CryptoProvider` interface and two implementations selected at module load time:

| Provider | Activated when | Implementation |
|---|---|---|
| `kms` | `ENCRYPTION_PROVIDER=kms` or `KMS_KEY_ID` is set | Delegates to `lib/kms.ts` (AWS KMS encrypt/decrypt) |
| `local` | `ENCRYPTION_PROVIDER=local` or `KMS_KEY_ID` is absent (default) | AES-256-GCM via Node.js `node:crypto`; `ENCRYPTION_KEY` required (64 hex chars = 32 bytes) |

### 17.2 Ciphertext Format

- **KMS:** base64-encoded KMS blob (existing format; unchanged)
- **Local:** `local:<iv_hex>:<ciphertext_hex>:<auth_tag_hex>` — the `local:` prefix allows the decrypt function to detect and route correctly even if `ENCRYPTION_PROVIDER` changes

### 17.3 Callers

`shell/lib/kms.ts` re-exports `encrypt`/`decrypt` from `crypto.ts` for backwards compatibility. Direct callers are:
- `shell/app/api/setup/complete/route.ts` (encrypt on wizard completion)
- `shell/lib/auth.ts:getOidcConfig()` (decrypt on every OIDC bootstrap)

### 17.4 Security Note

AES-256-GCM is equivalent security to KMS for single-tenant deployments. KMS is still recommended for production: it provides key rotation, audit trail via CloudTrail, and hardware-backed key storage. The `local` provider is suitable for local development and self-hosted deployments where those properties are not required.

---

## 18. StorageProvider Abstraction

### 18.1 Interface

`shell/lib/storage.ts` exports a `StorageProvider` interface and two implementations:

| Provider | Activated when | Implementation |
|---|---|---|
| `s3` | `STORAGE_PROVIDER=s3` or `AWS_S3_BUCKET` is set | S3 presigned PUT URL generation (existing behavior); CDN URL from `LOGO_CDN_BASE` |
| `local` | `STORAGE_PROVIDER=local` or `AWS_S3_BUCKET` is absent (default) | Writes file to `public/uploads/logos/`; returns relative URL `/uploads/logos/<filename>` |

### 18.2 Upload Flow Difference

- **S3 mode:** API returns `{ uploadUrl, publicUrl }`; client PUTs the file directly to S3 via the presigned URL, then stores `publicUrl` in `shell_config.logoUrl`.
- **Local mode:** API returns `{ publicUrl }` with no `uploadUrl`; client POSTs the file directly to the same route (multipart); route writes to disk and returns `publicUrl`.

`shell/app/setup/page.tsx` checks for the presence of `uploadUrl` in the response to determine which path to follow.

### 18.3 Callers

- `shell/app/api/setup/upload-logo/route.ts` (wizard step 1)
- `shell/app/(shell)/admin/branding` logo upload handler (existing duplicated S3 presign logic consolidated into `storage.ts`)

---

## 19. Open-Source Repository Infrastructure

The following files are added to support open-source contribution workflows. They have no runtime impact:

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local PostgreSQL for development (postgres:15-alpine, port 5432, named volume `postgres_data`) |
| `CONTRIBUTING.md` | Local dev setup, branching model, PR process, coding conventions, how to run tests |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Structured bug reports (environment, steps, expected vs. actual, logs) |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Structured feature requests (problem, proposed solution, alternatives) |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist (description, test plan, breaking changes, tests/types/lint pass) |
| `CHANGELOG.md` | Semantic versioning changelog starting at v1.0.0 listing M1–M13 features |

The `README.md` "Getting started" section is reordered to be local-first: Docker Compose → `.env.local` → `pnpm dev` as the primary path; AWS/Amplify deployment as a secondary path.

---

## 15. Template-as-Package Architecture

### 15.1 Overview

`src/shell` is published as `@corp/shell-app` to GitHub Packages. Consumers do not fork the repository — they provision a shell instance via the CLI and receive future updates as npm package versions.

```
GitHub Packages
  @corp/shell-app@x.y.z  ← full Next.js source tree
        ↓
npx @corp/create-shell-app init <name>
  → downloads @corp/shell-app, extracts source into <name>/
  → writes <name>/.shell-version

npx @corp/create-shell-app update [--version x.y.z]
  → downloads target @corp/shell-app version
  → full overwrite of shell source files
  → operator runs: pnpm install + pnpm drizzle-kit migrate
```

### 15.2 Customization Contract

The full-overwrite update model is safe because all instance-specific state lives outside the source tree:

| Concern | Location |
|---------|----------|
| Secrets, API keys | `.env.local` / Amplify env vars |
| Branding (logo, colors, name) | `shell_config` DB row (set via wizard / admin panel) |
| Navigation menus | `menu_sections` + `menu_items` DB tables |
| OIDC config | `shell_config.oidcClientSecret` (KMS-encrypted) |
| Roles & permissions | `roles` + `role_assignments` DB tables |
| Child app registry | `app_registry` DB table |

Operators MUST NOT modify shell source files. Any file in `src/shell/` is owned by `@corp/shell-app` and will be overwritten on update.

### 15.3 Version Tracking

A `.shell-version` file at the instance repo root records the installed version:

```
1.2.0
```

`create-shell-app update` reads this file to display a before/after version summary (`installed: 1.0.0 → target: 1.2.0`). It is written by both `init` and `update`.

### 15.4 CLI Subcommands

| Subcommand | Purpose |
|------------|---------|
| `init <name>` | Provision a new shell host instance from `@corp/shell-app` |
| `update [--version X.Y.Z]` | Full-overwrite update of current instance |
| `new <app-name>` | Scaffold a new Module Federation child app (existing behaviour) |

### 15.5 `src/shell/package.json` Changes Required for Publishing

```json
{
  "name": "@corp/shell-app",
  "version": "1.0.0",
  "private": false,
  "files": [
    "app",
    "components",
    "lib",
    "public",
    "middleware.ts",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "components.json",
    "instrumentation.ts",
    "proxy.ts",
    ".env.local.example",
    "package.json"
  ]
}
```

`.next/`, `node_modules/`, and `*.env.local` are excluded. The `files` array ships only the source, not build artefacts or secrets.

---

## 20. v2 Multi-Tenant Architecture (Planned — M16–M19)

> **This section describes the planned v2 design, not the current implementation.** Implementation begins after M15 is complete. All sections above (§1–§19) remain the authoritative description of the running system.

### 20.1 Overview of Changes

v2 adds multi-tenancy to a v1 deployment. The key design choices:

| Concern | v1 | v2 |
|---------|----|----|
| Tenant model | Single organization per deployment | Multiple orgs, one deployment |
| Data isolation | Single PG schema | Schema-per-tenant (`tenant_{slug}`) |
| Routing | Single domain (`app.corp.com`) | Wildcard subdomain (`*.corp.com`) |
| Tenant identity | N/A | Signed JWT carries `tenantId` + `tenantSlug` |
| IDP config | One OIDC provider in `shell_config` | Per-tenant `idpProviders` table |
| Subscription | Per-user `userSubscriptions` | Per-tenant singleton `tenantSubscription` |
| Provisioning | Auto-bootstrap + env-var OIDC | Platform admin only (`/platform/tenants`) |

### 20.2 Repository Structure Additions (v2)

New files added on top of the v1 structure:

```
src/shell/
├── app/
│   ├── (platform)/                  # Platform admin routes (tenant_platform schema only)
│   │   └── platform/
│   │       └── tenants/             # Tenant list + create form
│   └── suspended/                   # Shown when tenant status = suspended
├── api/
│   ├── admin/
│   │   └── sso/                     # Extended: multi-IDP CRUD (was read-only in v1)
│   ├── platform/
│   │   └── tenants/                 # Tenant provisioning API (platform admin only)
│   └── internal/
│       └── subscriptions/assign/    # Updated: tenant-level payload
├── lib/
│   ├── auth-config.ts               # getAuthConfig(tenantSlug) — loads IDP providers per tenant
│   ├── tenant-slug.ts               # getTenantSlug(host) with TENANT_SLUG env override
│   ├── platform-guard.ts            # isPlatformAdmin(token)
│   └── db/
│       ├── tenant.ts                # withTenant(slug) — schema-scoped Drizzle client factory
│       └── provision.ts             # provisionTenant() + autoBootstrapPlatform() — schema creation, migrations, seeding
```

### 20.3 High-Level Topology (v2)

```
Browser (acme.corp.com / globocorp.corp.com / platform.corp.com)
  │
  │  HTTPS  *.corp.com  (wildcard cert — ACM us-east-1)
  ▼
Route 53 ──→ CloudFront (ONE distribution, wildcard alternate domain)
                │
                ├──→ Lambda@Edge          ONE Next.js app (same Amplify deployment)
                │      │  reads Host header at login boundary only
                │      │  withTenant(slug) scopes all DB queries per request
                │      ▼
                │    PostgreSQL (one DB)
                │      ├── public schema         tenants registry
                │      ├── tenant_acme schema     isolated per-tenant data
                │      ├── tenant_globocorp schema
                │      └── tenant_platform schema  platform super admins
                │
                └──→ S3 (shell static assets — shared across all tenants)

  OIDC (PKCE) — per-tenant, loaded from tenant_{slug}.idpProviders at login
  Callback URL: https://{tenantSlug}.corp.com/api/auth/callback/{providerId}
```

**CloudFront wildcard DNS setup (manual, one-time):**
- ACM: request wildcard cert `*.corp.com` in `us-east-1`; validate via DNS
- Route 53: `*.corp.com` ALIAS → existing CloudFront distribution
- CloudFront: add `*.corp.com` as alternate domain name; attach wildcard cert
- Amplify origin unchanged — CloudFront routes all subdomains to the same Next.js app

**Local dev:** Set `TENANT_SLUG=acme` in `.env.local` to bypass host-header parsing. No wildcard DNS needed.

### 20.4 Database Schema (v2)

**`public` schema** — cross-tenant registry only:

| Table | Columns |
|-------|---------|
| `public.tenants` | `id` (uuid PK), `slug` (text unique), `displayName` (text), `status` (enum: active\|suspended\|deleted), `createdAt` |

**`tenant_{slug}` schema** — full per-tenant data, created by `provisionTenant()`:

| Table | Notes vs. v1 |
|-------|-------------|
| `shellConfig` | Same as v1; OIDC fields (`oidcIssuer`, `oidcClientId`, `oidcClientSecret`) removed — moved to `idpProviders` |
| `users` | Same as v1 |
| `roles` | Same as v1 |
| `userRoles` | Same as v1 |
| `idpProviders` | **New** — replaces `shell_config` OIDC fields; supports multiple providers per tenant |
| `idpGroupRoleMappings` | Same as v1; gains `idpProviderId` FK to scope mappings per provider |
| `subscriptionTiers` | Same as v1 |
| `tenantSubscription` | **New** — replaces per-user `userSubscriptions`; org-level singleton |
| `menuSections` | Same as v1 |
| `menuItems` | Same as v1 |
| `appRegistry` | Same as v1 |
| `authEvents` | Same as v1 |
| `notifications` | Same as v1 |
| `notificationReads` | Same as v1 |

**`idpProviders` table:**
```
id                    uuid PK defaultRandom()
displayName           text NOT NULL
issuer                text NOT NULL
clientId              text NOT NULL
encryptedClientSecret text NOT NULL        -- CryptoProvider encrypted
scopes                text[] NOT NULL
groupClaimName        text
isEnabled             boolean NOT NULL default true
createdAt             timestamp defaultNow()
```

**`tenantSubscription` table (singleton per tenant):**
```
tierId      uuid FK → subscriptionTiers.id  NOT NULL
status      enum: active | trialing | past_due | canceled  NOT NULL default 'active'
expiresAt   timestamp (nullable)
assignedAt  timestamp defaultNow()
```

**`tenant_platform` schema:** Same table structure as a normal tenant schema. Users in this schema are platform super admins. `isPlatformAdmin()` asserts both `super_admin` role AND `token.tenantSlug === "platform"`.

### 20.5 `withTenant(slug)` Drizzle Client Factory

`lib/db/tenant.ts` — all per-tenant DB access goes through this factory:

```typescript
export function withTenant(slug: string) {
  const client = postgres(connectionString, {
    connection: { search_path: `tenant_${slug},public` },
  });
  return drizzle(client, { schema });
}
```

The global `db` export from `client.ts` is used **only** for `public.tenants` queries (login tenant lookup, platform admin CRUD, health check). All other application code uses either `getTenantDb()` (which reads the tenant slug from the current session) or `withTenant(slug)` (for contexts where the slug is already known, such as login callbacks and cached functions).

### 20.6 `provisionTenant()` Provisioning Flow

`lib/db/provision.ts` — called exclusively from `POST /api/platform/tenants`:

1. Validate `slug` matches `/^[a-z0-9-]+$/` — throw if invalid
2. Assert slug uniqueness in `public.tenants` — throw if taken
3. `INSERT public.tenants` (status: active)
4. `CREATE SCHEMA tenant_{slug}` via raw SQL
5. Run DDL for all per-tenant tables against the new schema (via `withTenant(slug)`)
6. Seed: default `shellConfig`, `subscriptionTiers` (free/standard/enterprise), `roles` (super_admin, admin), initial admin `users` row, `userRoles`, `tenantSubscription` (free tier)
7. Return the created tenant record

No public signup path exists. All tenant creation is platform-admin-only.

### 20.7 Request Lifecycle (v2)

```
1. Browser → CloudFront → Lambda (Next.js middleware.ts)

2. middleware.ts:

   Unauthenticated login paths (/login, /api/auth/**):
     a. getTenantSlug(host) → extract slug
        (or TENANT_SLUG env var for local dev)
     b. SELECT * FROM public.tenants WHERE slug = ? → 404 if not found
     c. tenant.status === "suspended" → redirect /suspended
     d. proceed; getAuthConfig(slug) loads IDP providers for this tenant

   Authenticated paths:
     a. decode JWT (no DB hit)
     b. assert token.tenantSlug === getTenantSlug(host) → 401 if mismatch
     c. /platform/** → assert isPlatformAdmin(token) → 403 if false
     d. continue with withTenant(token.tenantSlug) for all downstream DB access
     e. check route RBAC (roles from JWT) — same as v1

3. Server Component (layout.tsx):
     auth() reads session (no DB hit)
     withTenant(slug) → fetch menu, filter by roles + subscriptionTier
     render Sidebar + Header

4. API routes (/api/**):
     read token.tenantSlug from session
     all DB calls: withTenant(tenantSlug)
     platform routes: additionally assert isPlatformAdmin()
```

### 20.8 Authentication Flow (v2)

```
User hits acme.corp.com/login (unauthenticated)
  → middleware: getTenantSlug(host) → "acme"
  → getAuthConfig("acme"):
      SELECT * FROM tenant_acme.idpProviders WHERE isEnabled = true
      → build NextAuth OidcProvider[] from DB rows (secrets decrypted via CryptoProvider)
      → callback URL per provider: https://acme.corp.com/api/auth/callback/{providerId}
  → NextAuth v5 factory pattern: NextAuth(async (req) => getAuthConfig(slug))
  → OIDC login → callback
  → jwt() callback:
      1. Extract groups[] from ID token
      2. withTenant("acme"): map IDP groups → shell roles
      3. withTenant("acme"): read tenantSubscription → subscriptionTier + subscriptionLevel
      4. New user? JIT-provision into tenant_acme:
           INSERT users, INSERT userRoles
      5. Write tenant_acme.authEvents (LOGIN)
      6. Embed { userId, roles, tenantId, tenantSlug,
                 subscriptionTier, subscriptionLevel } in JWT
  → Encrypted JWT in httpOnly Secure cookie
  → Redirect to originally requested URL

Subsequent requests: JWT decoded; tenantSlug asserted against host; withTenant() used for all DB access.
```

### 20.9 `getAuthConfig(tenantSlug)` Dynamic IDP Loading

`lib/auth-config.ts`:

```typescript
export async function getAuthConfig(tenantSlug: string): Promise<NextAuthConfig> {
  const db = withTenant(tenantSlug);
  const providers = await db.select().from(schema.idpProviders)
    .where(eq(schema.idpProviders.isEnabled, true));

  return {
    providers: await Promise.all(providers.map(async (p) => ({
      id: p.id,
      name: p.displayName,
      type: "oidc" as const,
      issuer: p.issuer,
      clientId: p.clientId,
      clientSecret: await decrypt(p.encryptedClientSecret),
      authorization: { params: { scope: p.scopes.join(" ") } },
    }))),
  };
}
```

`lib/auth.ts` uses the NextAuth v5 factory pattern:

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth(async (req) => {
  const slug = getTenantSlug(req?.headers?.get("host") ?? "");
  return {
    ...await getAuthConfig(slug),
    callbacks: { jwt: tenantJwtCallback(slug) },
  };
});
```

### 20.10 Org-Level Subscription (v2)

v2 removes per-user `userSubscriptions` and replaces it with a per-tenant singleton `tenantSubscription`. All users in the tenant inherit the org tier.

- `jwt()` callback reads `tenantSubscription` (not per-user rows) → writes `subscriptionTier` + `subscriptionLevel` to JWT
- All existing subscription gating in middleware and Server Components is unchanged — only the data source differs
- The webhook endpoint (`POST /api/internal/subscriptions/assign`) is updated: payload changes from `{ userId, tierId, expiresAt? }` to `{ tenantSlug, tierId, expiresAt? }`
- Platform admin assigns tiers via the platform panel UI or the webhook

### 20.11 Platform Admin Panel (v2)

`https://platform.corp.com/platform/tenants` — accessible only to users in `tenant_platform` with `super_admin` role.

**`isPlatformAdmin(token)` guard:**
```typescript
export function isPlatformAdmin(token: JWT): boolean {
  return token.tenantSlug === "platform" && token.roles.includes("super_admin");
}
```

**Actions:**
- List all tenants (reads `public.tenants` + user count per schema)
- Create tenant → `provisionTenant()` → platform admin sends setup link to tenant admin email
- Suspend tenant → `UPDATE public.tenants SET status = 'suspended'` → middleware blocks logins
- Soft-delete tenant → `UPDATE public.tenants SET status = 'deleted'` (schema not dropped)
- Assign subscription tier → writes to `tenant_{slug}.tenantSubscription`

**Bootstrapping:** The platform tenant is auto-provisioned on the first request when no tenants exist in the database (`autoBootstrapPlatform()` in `provision.ts`). Platform OIDC is configured via environment variables (`PLATFORM_OIDC_ISSUER`, `PLATFORM_OIDC_CLIENT_ID`, `PLATFORM_OIDC_CLIENT_SECRET`). The first user to log in receives the `super_admin` role automatically.

### 20.12 Security Properties (v2)

| Concern | Mitigation |
|---------|-----------|
| Cross-tenant token replay | Middleware asserts `token.tenantSlug === getTenantSlug(host)` on every authenticated request; mismatch → 401 |
| Tenant data isolation | All DB access via `withTenant(slug)` which sets `search_path = tenant_{slug},public`; application code cannot reach another tenant's schema |
| Platform admin privilege escalation | `isPlatformAdmin()` requires both `super_admin` role AND `tenantSlug === "platform"` — role alone is insufficient |
| IDP secret at rest | `encryptedClientSecret` encrypted via `CryptoProvider` before write; same abstraction as v1 OIDC secret |
| Host header trust | Host header trusted only at unauthenticated login initiation; signed JWT is authoritative for all authenticated requests |

### 20.13 Key Architectural Decisions (v2)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema-per-tenant over separate DBs | PostgreSQL schema-per-tenant | One DB to operate; Drizzle `search_path` scoping; no cross-tenant joins possible; migration tooling unchanged |
| JWT-authoritative tenant identity | Host trusted only at login; JWT carries `tenantSlug` | Stateless per-request tenant resolution; cross-tenant replay detectable without DB roundtrip |
| Single Amplify app for all tenants | One CloudFront + one Next.js origin | No per-tenant deployments; wildcard cert handles all subdomains; all tenants updated simultaneously |
| Platform-admin-only provisioning | No public signup | Prevents arbitrary schema creation; controlled onboarding; defers self-serve to v3 |
| Org-level subscription | `tenantSubscription` singleton | Simpler billing model; all users in org inherit tier; no per-seat complexity until v3 |

---

*End of Architecture Design (v1.1 implemented / v2.0 planned)*
