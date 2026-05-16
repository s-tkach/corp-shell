# Architecture Design: Corporate Application Shell
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-05-16  
**PRD Reference:** `specs/PRD.md` v1.2

---

## 1. Overview

The Corporate Application Shell is a **Next.js 15 monorepo** deployed serverlessly on AWS via SST v3. It acts as a host for independently deployed micro-frontends (Module Federation), provides SSO via OIDC, and exposes an admin panel for all runtime configuration. There is no separate backend service — Next.js API routes serve as the API layer.

---

## 2. Repository Structure

```
aws-corp-shell-app/                  ← monorepo root
├── sst.config.ts                    # SST Ion — all AWS resource definitions
├── package.json                     # Workspace root (pnpm workspaces)
├── shell/                           # Next.js 15 application
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
│   │   │   │   └── branding/
│   │   │   └── [...slug]/           # Child app catch-all (Client Component)
│   │   └── setup/                   # First-run wizard (404 after completion)
│   ├── api/
│   │   ├── auth/[...nextauth]/      # NextAuth.js v5 handler
│   │   ├── menu/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── apps/
│   │   ├── subscriptions/
│   │   ├── admin/
│   │   └── internal/
│   │       └── webhooks/            # Payment provider webhook (HMAC-SHA256)
│   ├── components/
│   │   ├── shell/                   # Sidebar, Header, Breadcrumbs, ErrorBoundary, AppSkeleton
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
│   └── create-shell-app/            # @corp/create-shell-app CLI
│       ├── src/
│       │   └── index.ts             # npx scaffolder entry
│       └── template/                # Child app project template
└── stacks/
    └── child-app-stack.ts           # Reusable SST stack: S3 + CloudFront per child app
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
| Database | Aurora Serverless v2 (PostgreSQL) | 15.x | Scales to zero in dev; single DB for all shell data |
| Compute | AWS Lambda via SST v3 | — | Serverless Next.js; no EC2/ECS |
| CDN / Static | AWS CloudFront + S3 | — | Shell assets + child app remoteEntry files |
| DNS / TLS | Amazon Route 53 + ACM | — | Custom domain, auto-renewing SSL |
| Secrets | AWS Secrets Manager | — | OIDC client secret, webhook HMAC key, DB URL |
| IaC | SST v3 (Ion / Pulumi) | 3.x | Single `sst.config.ts` defines all resources |
| CI/CD | GitHub Actions | — | Shell and child apps deploy independently |
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
                │    Aurora Serverless v2 (PostgreSQL)
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
  OIDC_CLIENT_SECRET, WEBHOOK_SECRET, DATABASE_URL

GitHub Packages
  @corp/shell-sdk, @corp/create-shell-app
```

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
                                               Setup Wizard steps
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
2. Add `IDP_CLIENT_ID` / `IDP_CLIENT_SECRET` env vars (Secrets Manager)
3. No structural code changes

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

- **Engine:** Aurora Serverless v2 (PostgreSQL 15), private VPC subnet.
- **Connection:** Drizzle ORM with `@neondatabase/serverless` or `postgres` (non-pooling) driver — safe for Lambda cold starts, no persistent connection pool.
- **Credentials:** `DATABASE_URL` stored in Secrets Manager; injected as Lambda env var by SST.

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
| `shell_config` | Single-row: branding, OIDC issuer, setup_complete flag |
| `auth_events` | Login/logout/failure events (viewer UI in v2) |

### 9.3 Migrations

Managed by Drizzle Kit. Migration files live in `shell/lib/db/migrations/`. Applied as part of the SST deploy pipeline before Lambda traffic shifts.

---

## 10. Infrastructure (SST v3 / Ion)

### 10.1 Resource Map

```typescript
// sst.config.ts (logical structure)

const db = new sst.aws.Aurora("ShellDb", {
  engine: "postgresql",
  serverless: true,
  vpc,
});

const secret = new sst.aws.Secret("OidcClientSecret");

const shell = new sst.aws.Nextjs("Shell", {
  path: "shell/",
  environment: {
    DATABASE_URL: db.secretArn,          // resolved at runtime from Secrets Manager
    OIDC_CLIENT_SECRET: secret.value,
  },
  domain: { name: "app.corp.com", dns: sst.aws.dns() },
});

// Reusable stack for each child app (stacks/child-app-stack.ts):
const childApp = new sst.aws.StaticSite("ChildApp", {
  path: "s3://corp-child-apps/{app-name}/",
  cdn: true,
});
```

### 10.2 Environments

| Environment | Aurora | Lambda | Notes |
|-------------|--------|--------|-------|
| `dev` | Paused (0 ACU) | Scales to zero | Near-zero cost |
| `staging` | 0.5 ACU min | Active | Pre-prod smoke testing |
| `prod` | 0.5–2 ACU | Active | Auto-scales to demand |

### 10.3 Secrets

| Secret | Storage | Consumed By |
|--------|---------|------------|
| `OIDC_CLIENT_SECRET` | Secrets Manager | Lambda (NextAuth.js) |
| `OIDC_CLIENT_ID` | Secrets Manager | Lambda (NextAuth.js) |
| `DATABASE_URL` | Secrets Manager | Lambda (Drizzle ORM) |
| `NEXTAUTH_SECRET` | Secrets Manager | Lambda (NextAuth.js JWT encryption) |
| `WEBHOOK_SECRET` | Secrets Manager | Lambda (HMAC-SHA256 webhook validation) |

All injected into Lambda env by SST at deploy time — never in source files or `.env` committed to git.

---

## 11. CI/CD

### 11.1 Shell Pipeline (GitHub Actions)

```
on: push to main (shell/** or sst.config.ts changed)
  ↓
pnpm install
  ↓
pnpm typecheck + pnpm lint
  ↓
pnpm test
  ↓
pnpm drizzle-kit migrate (apply pending migrations to target stage)
  ↓
npx sst deploy --stage prod
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

### 11.3 SDK / CLI Publish Pipeline

```
on: push tag v*.*.*  (packages/shell-sdk or packages/create-shell-app)
  ↓
pnpm build
  ↓
npm publish --access restricted  (NODE_AUTH_TOKEN = GITHUB_TOKEN)
  → @corp/shell-sdk on GitHub Packages
```

---

## 12. Security Architecture

| Concern | Mitigation |
|---------|-----------|
| Session tokens | `httpOnly` encrypted JWT cookie only; never `localStorage` |
| CSRF | NextAuth.js built-in CSRF token on all state-mutating API routes |
| Admin route bypass | Server-side role check in every API handler + middleware — no client-only guard |
| Webhook forgery | HMAC-SHA256 with `WEBHOOK_SECRET` from Secrets Manager; constant-time compare |
| Secret leakage | All secrets in Secrets Manager; zero secrets in source or git history |
| XSS | Shadcn/ui + React; no `dangerouslySetInnerHTML`; CSP header via CloudFront |
| Child app crash | React ErrorBoundary per child app mount; shell unaffected |
| OIDC misconfiguration | Setup wizard validates the OIDC discovery endpoint before proceeding |
| Lockout prevention | `super_admin` role is system-owned; cannot be deleted or self-revoked via wizard |

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

Step 1 — Branding:   POST /api/setup/upload-logo → S3 presigned PUT
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
| Module Federation over iFrame | MF (v1) | Shared React context, SDK hooks, and design tokens; iFrame in v2 |
| Aurora Serverless v2 over DynamoDB | Aurora (PostgreSQL) | RBAC, menu, and admin queries are relational; Drizzle ORM type safety |
| Single AWS account | One account | Simplified IAM, networking, and cost tracking for v1 |
| Fork over build from scratch | `satnaing/shadcn-admin` | Sidebar, header, Shadcn wiring already done; focus on domain logic |
| GitHub Packages over npm | GitHub Packages | Org-private packages; GITHUB_TOKEN auth in Actions without extra secrets |
| SST v3 (Ion) over CDK/SAM | SST | First-class Next.js support; single config file; dev/prod parity |

---

*End of Architecture Design v1.0*
