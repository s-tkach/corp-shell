# Roadmap: Corporate Application Shell
**Version:** 2.0  
**Status:** Updated  
**Date:** 2026-05-24  
**PRD Reference:** `specs/PRD.md` v2.0  
**Architecture Reference:** `specs/ARCHITECTURE.md` v2.0

---

## Principles

- Each milestone produces a **working, deployable increment** — no milestone ends in a broken state.
- Tasks within a milestone are ordered by dependency. Do not start a task until its predecessors are done.
- Acceptance criteria are the definition of done. No task is complete until all criteria pass.
- No application code is written outside this roadmap's task order.

---

## Milestones at a Glance

| # | Milestone | Deliverable |
|---|-----------|-------------|
| M1 | Monorepo & Infrastructure Scaffold | Deployable empty shell on AWS |
| M2 | Database Schema & Migrations | All tables live; Drizzle migrations running |
| M3 | Platform Auto-Bootstrap | Platform tenant auto-provisioned; first user becomes super admin |
| M4 | Authentication & Session | OIDC login/logout/JIT provisioning |
| M5 | RBAC & Middleware | Role-gated routes enforced end-to-end |
| M6 | Navigation Shell & Menu System | Data-driven sidebar, header, theme toggle |
| M7 | Admin Panel | All 7 admin sections fully functional |
| M8 | Module Federation Host | Child apps mountable via MF |
| M9 | Shell SDK & CLI | `@corp/shell-sdk` and `@corp/create-shell-app` published |
| M10 | Subscription & Entitlement Engine | Tier-gated nav, upgrade prompt, webhook |
| M11 | Observability & Security Hardening | Logging, tracing, CSP, audit events |
| M12 | Performance & Load Validation | NFR targets verified under load |
| M13 | Notifications System | Bell icon, dropdown, SSE toasts, admin page, session-auth push API |
| M14 | Open-Source Readiness | AWS dependencies optional; local dev path; OSS DX files; Vitest test coverage |
| M15 | Shell as Distributable Package | `@corp/shell-app` published; `init` and `update` CLI subcommands |
| M16 | Multi-Tenant Data Model | Schema-per-tenant; `withTenant()` factory; `provisionTenant()` |
| M17 | Subdomain Routing + Tenant JWT | CloudFront wildcard DNS; host-based login boundary; tenantSlug in JWT |
| M18 | Dynamic IDP Registration | Per-tenant `idpProviders` table; `getAuthConfig()`; multi-IDP admin UI |
| M19 | Platform Admin Tenant Management *(planned)* | `/platform/tenants` panel; provisioning API; org-level subscription |

---

## M1 — Monorepo & Infrastructure Scaffold

**Goal:** A deployable, empty Next.js shell running on AWS. No features — just the skeleton that every subsequent task builds on.

### Tasks

#### M1-1: Initialize pnpm monorepo
- [x] `pnpm init` at repo root; configure `pnpm-workspace.yaml` with `packages: [shell, packages/*]`
- [x] Add root `package.json` with `engines.node`, `engines.pnpm`, and shared dev dependencies (`typescript`, `eslint`, `prettier`)
- [x] Add `.nvmrc` / `.node-version` pinned to Node 22 LTS
- [x] **Acceptance:** `pnpm install` completes; workspace packages resolve correctly

#### M1-2: Scaffold Next.js 15 shell app
- [x] `pnpm create next-app shell --typescript --tailwind --app --no-src-dir`
- [x] Install Shadcn/ui: `pnpm dlx shadcn@latest init` (select Tailwind v4, CSS variables)
- [x] Copy sidebar, header, layout shell, and breadcrumb components from `satnaing/shadcn-admin` (Vite → Next.js App Router adaptation)
- [x] Confirm dark/light mode toggle works with Shadcn's `ThemeProvider`
- [x] **Acceptance:** `pnpm --filter shell dev` starts; sidebar and header render at `localhost:3000`

#### M1-3: Configure TypeScript & linting
- [x] Strict `tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/ → shell/`)
- [x] ESLint config: `next/core-web-vitals` + `@typescript-eslint/recommended`
- [x] Prettier config with consistent formatting rules
- [x] Add `pnpm typecheck` and `pnpm lint` scripts to root
- [x] **Acceptance:** `pnpm typecheck` and `pnpm lint` both pass with zero errors on the scaffold

#### M1-4: Configure AWS Amplify hosting
- [x] Shell hosted on AWS Amplify (manually configured, outside repo)
- [x] PostgreSQL, Secrets Manager, and Route 53 provisioned separately
- [x] Environment variables (OIDC, DB, NextAuth secrets) set in Amplify console
- [x] **Acceptance:** Amplify build succeeds; CloudFront URL returns Next.js app

---

## M2 — Database Schema & Migrations

**Goal:** All database tables exist in the target environment; Drizzle ORM client is wired into the shell.

### Tasks

#### M2-1: Install and configure Drizzle ORM
- [x] `pnpm --filter shell add drizzle-orm postgres`; `pnpm --filter shell add -D drizzle-kit`
- [x] Create `shell/lib/db/client.ts`: instantiate Drizzle with `postgres` driver using `DATABASE_URL` from env
- [x] Add `drizzle.config.ts` at root pointing to `shell/lib/db/schema.ts` and `shell/lib/db/migrations/`
- [x] **Acceptance:** `pnpm drizzle-kit generate` runs without error; client imports without type errors

#### M2-2: Define schema
- [x] Implement all tables in `shell/lib/db/schema.ts` as specified in `ARCHITECTURE.md §9.2`:
  `users`, `roles`, `user_roles`, `idp_group_role_mappings`, `subscription_tiers`, `user_subscriptions`, `menu_sections`, `menu_items`, `app_registry`, `shell_config`, `auth_events`
- [x] **Acceptance:** `pnpm drizzle-kit generate` produces a single coherent migration; no type errors in schema file

#### M2-3: Apply initial migration
- [x] Run `pnpm drizzle-kit migrate` against the dev PostgreSQL instance
- [x] Verify all tables and constraints exist via `psql` or Drizzle Studio
- [x] Add migration step to run before Amplify deploys
- [x] **Acceptance:** All 11 tables present in dev DB; pipeline applies migrations automatically on deploy

---

## M3 — Platform Auto-Bootstrap

**Goal:** A fresh deployment auto-provisions the platform tenant on first request. Platform OIDC is configured via env vars. First user to log in becomes super admin. No setup wizard required.

### Tasks

#### M3-1: Auto-bootstrap middleware
- [x] In `proxy.ts`: if no tenants exist in the DB, auto-provision the platform tenant
- [x] Platform OIDC configured via `PLATFORM_OIDC_ISSUER`, `PLATFORM_OIDC_CLIENT_ID`, `PLATFORM_OIDC_CLIENT_SECRET` env vars
- [x] First OIDC login to platform tenant auto-assigns `super_admin` role
- [x] **Acceptance:** Visiting any route on a fresh DB auto-bootstraps platform tenant and redirects to `/login`

#### M3-2: Platform admin tenant management
- [x] Platform admin creates tenants from `/platform/tenants` with OIDC config (issuer, client ID, client secret), admin email, and optional branding
- [x] OIDC discovery validated via "Test Connection" button
- [x] Platform admin invites additional admins from `/platform/admins`
- [x] Sidebar shows "Tenants" and "Platform Admins" links for platform super admins
- [x] **Acceptance:** Tenant created with OIDC config; tenant's login page shows SSO button; platform admins can be invited

---

## M4 — Authentication & Session

**Goal:** OIDC login/logout works end-to-end; JIT provisioning creates user records on first login; session is embedded in an httpOnly JWT cookie.

### Tasks

#### M4-1: Install and configure NextAuth.js v5
- [x] `pnpm --filter shell add next-auth@beta`
- [x] Create `shell/lib/auth.ts`: configure OIDC provider reading `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` from Secrets Manager (resolved at Lambda start)
- [x] Wire `GET/POST /api/auth/[...nextauth]` route handler
- [x] Set `NEXTAUTH_SECRET` (Secrets Manager) for JWT encryption
- [x] **Acceptance:** Visiting a protected route redirects to the OIDC provider; successful login returns to shell

#### M4-2: JWT callback — group mapping & subscription resolution
- [x] In NextAuth.js `jwt()` callback:
  1. Extract `groups[]` from OIDC ID token
  2. Query `idp_group_role_mappings` → resolve shell role slugs
  3. Query `user_subscriptions` → get tier and level
  4. Embed `{ userId, roles, subscriptionTier, subscriptionLevel }` in JWT payload
- [x] **Acceptance:** `session.user.roles` and `session.user.subscriptionLevel` are populated after login

#### M4-3: JIT user provisioning
- [x] In `jwt()` callback, if user email not found in `users` table:
  - `INSERT users` (email, displayName, idpSource='oidc', idpSubject)
  - `INSERT user_roles` for each mapped role
  - `INSERT user_subscriptions` (free tier)
  - `INSERT auth_events` (LOGIN + JIT_PROVISION)
- [x] Existing users: update `lastLoginAt`; write `auth_events` (LOGIN)
- [x] **Acceptance:** First login creates user record; subsequent logins update `lastLoginAt`; no duplicate rows

#### M4-4: Logout — RP-Initiated Logout
- [x] `signOut()` handler: clear local session cookie + redirect to OIDC RP-Initiated Logout endpoint
- [x] Write `auth_events` (LOGOUT) before clearing session
- [x] **Acceptance:** Logging out clears the cookie and ends the OIDC provider session (verified by attempting to access a protected resource immediately after)

#### M4-5: Auth failure handling
- [x] `/app/(auth)/error/page.tsx`: display human-readable message for NextAuth.js error codes (`OAuthCallbackError`, `AccessDenied`, etc.)
- [x] Write `auth_events` (FAILURE) for any callback error
- [x] **Acceptance:** Simulated OIDC error shows friendly error page; failure event written to DB

---

## M5 — RBAC & Middleware

**Goal:** All protected routes are gated at the middleware layer; admin routes additionally require `super_admin` or `admin`; unauthorized access returns 403 without a redirect loop.

### Tasks

#### M5-1: Route protection middleware
- [x] Extend `shell/middleware.ts` (post-setup path):
  - No session → redirect to `/api/auth/signin`
  - Session valid → continue
- [x] Apply to all routes except `/api/auth/**`, `/(auth)/**`, `/_next/**`, `/favicon.ico`
- [x] **Acceptance:** Unauthenticated request to `/dashboard` redirects to the OIDC provider; authenticated request passes through

#### M5-2: Admin route guard
- [x] Middleware: for routes matching `/admin/**` and `/api/admin/**`, assert `session.roles` includes `super_admin` or `admin`
- [x] Unauthorized → render `app/(shell)/403/page.tsx` with "Access Denied" message (no redirect loop)
- [x] **Acceptance:** User without admin role visiting `/admin/menu` sees 403 page; admin role user passes through

#### M5-3: API route role enforcement
- [x] Create `shell/lib/auth-guard.ts`: `requireRoles(roles: string[])` helper — reads session, throws 403 response if roles not satisfied
- [x] Apply to all `admin/**` API handlers and any other role-restricted endpoints
- [x] **Acceptance:** `curl` to `/api/admin/users` without admin session returns HTTP 403 JSON

#### M5-4: 403 page
- [x] `app/(shell)/403/page.tsx`: "Access Denied" UI with link back to `/dashboard`
- [x] **Acceptance:** Renders correctly for both middleware-blocked and API-blocked scenarios

---

## M6 — Navigation Shell & Menu System

**Goal:** The sidebar renders from the database, filters items by the session's roles and subscription level, and persists collapse state and theme per user.

### Tasks

#### M6-1: Menu API
- [x] `GET /api/menu`: reads `menu_sections` + `menu_items` from DB, filters by `session.roles` and `session.subscriptionLevel`, returns ordered tree
- [x] Response cached with a short TTL (revalidated on menu config change via Admin Panel)
- [x] **Acceptance:** API returns correct items for a given role/tier combination; items the user lacks access to are absent

#### M6-2: Server-side menu render in RootLayout
- [x] `shell/app/layout.tsx` (Server Component): call `auth()` → call `/api/menu` (server-side fetch) → pass menu tree to `<Sidebar>`
- [x] `<Sidebar>` renders sections and items; highlights active route
- [x] **Acceptance:** Sidebar shows role-filtered menu on every page load without client-side flash

#### M6-3: Sidebar collapse state persistence
- [x] Zustand store for collapse state (client-side optimistic)
- [x] On toggle: `PATCH /api/users/me/preferences` writes `sidebarCollapsed` to a `user_preferences` JSON column on `users`
- [x] On load: initial state read from session (embedded at login) or API
- [x] **Acceptance:** Collapse state survives page refresh and new browser sessions for the same user

#### M6-4: Top header bar
- [x] App logo + name from `shell_config` (server-fetched in RootLayout)
- [x] Breadcrumb trail derived from current route and menu tree
- [x] User avatar dropdown: display name, role badges, logout button
- [x] Notification slot (empty div with `data-shell-notifications` — child apps can mount here via SDK)
- [x] **Acceptance:** Logo, name, breadcrumbs, and user dropdown all render correctly; logout triggers M4-4 flow

#### M6-5: Light/dark mode toggle
- [x] Shadcn `ThemeProvider` already installed (M1-2); wire toggle button in header
- [x] Persist preference: `PATCH /api/users/me/preferences` with `theme: 'light' | 'dark'`
- [x] On load: server embeds theme preference in root HTML `class` to avoid flash
- [x] **Acceptance:** Toggle changes theme instantly; preference persists across sessions

---

## M7 — Admin Panel

**Goal:** All 7 admin sections are functional. Admins can manage all shell configuration without touching code or redeploying.

### Tasks

#### M7-1: Admin layout & navigation
- [x] `app/(shell)/admin/layout.tsx`: guard renders 403 if role check fails (redundant with middleware — defense in depth)
- [x] "Admin" section in sidebar visible only to `super_admin` and `admin` roles
- [x] **Acceptance:** Admin sidebar section hidden for non-admin users; visible for admin users

#### M7-2: Menu Manager
- [x] Full CRUD for `menu_sections` and `menu_items`
- [x] Drag-and-drop reorder (updates `sortOrder` in DB)
- [x] Inline role multi-select and subscription level picker per item
- [x] Live role-filtered preview panel (renders sidebar as a given role would see it)
- [x] **Acceptance:** Create/edit/delete/reorder items; changes reflected in sidebar within one page load

#### M7-3: Role Manager
- [x] CRUD for roles (cannot delete or rename `super_admin`)
- [x] IDP Mapping editor: add/remove IDP group → shell role mappings in `idp_group_role_mappings`
- [x] "Users with this role" count displayed per role
- [x] **Acceptance:** New role created; IDP group mapped; mapping visible in `idp_group_role_mappings`

#### M7-4: User Manager
- [x] Paginated table of all `users` (email, displayName, roles, subscriptionTier, lastLoginAt, isActive)
- [x] Assign/revoke roles per user (writes `user_roles`)
- [x] Set subscription tier + expiry (writes `user_subscriptions`)
- [x] Deactivate user (sets `isActive = false`; deactivated users are blocked at middleware)
- [x] **Acceptance:** Role assignment takes effect on user's next login; deactivated user cannot log in

#### M7-5: SSO Status
- [x] Read-only display of `shell_config.oidcIssuer` and `OIDC_CLIENT_ID` (non-secret)
- [x] Live reachability check: server pings `https://{domain}/.well-known/openid-configuration` on page load
- [x] Displays "Connected ✓" or error detail
- [x] **Acceptance:** Connected state shows correctly; simulated bad domain shows error detail

#### M7-6: Application Registry
- [x] Register child app: `name`, `remoteUrl`, `routePrefix`, `healthCheckUrl`
- [x] "Validate & Fetch Manifest": server fetches `{remoteUrl}/mf-manifest.json`, validates shape, previews routes
- [x] Route-to-menu-item mapping UI
- [x] Live health status: periodic ping of `healthCheckUrl`; `lastHealthyAt` updated in DB
- [x] Enable/disable app toggle
- [x] **Acceptance:** Registered app manifest validates; app appears in MF remote list within 60 seconds

#### M7-7: Subscription Tiers
- [x] CRUD for `subscription_tiers` (cannot delete `free` — it is the default)
- [x] Set numeric level per tier
- [x] Configure Upgrade Prompt content (headline, body, CTA label, CTA URL) per tier
- [x] **Acceptance:** New tier created with level; upgrade prompt content saves and renders on restricted route

#### M7-8: Theme & Branding
- [x] Edit app name, re-upload logo (new S3 presigned PUT), change primary brand color
- [x] Live preview panel reflecting changes before save
- [x] `PATCH /api/admin/branding` writes to `shell_config`; changes apply globally without redeploy
- [x] **Acceptance:** Name and logo update reflected in header within one page reload

---

## M8 — Module Federation Host

**Goal:** Child apps registered in the Application Registry can be loaded into the shell's `[...slug]` catch-all route via Module Federation.

### Tasks

#### M8-1: Install and configure `@module-federation/nextjs-mf`
- [x] `@module-federation/nextjs-mf` is incompatible with Next.js 16 (supports up to 15); implemented via runtime script federation instead
- [x] `shell/next.config.ts`: added `transpilePackages: ["@corp/shell-sdk"]`; remotes resolved at runtime via `shell/lib/mf/router.ts`
- [x] `proxy.ts` merged with deprecated `middleware.ts` (Next.js 16 requires one file only)
- [x] **Acceptance:** `pnpm --filter shell build` compiles successfully; no shared module conflicts

#### M8-2: Remote resolution and route registry
- [x] `shell/lib/mf/router.ts`: `fetchRegisteredApps()` queries `app_registry` with 60-second cache; `resolveAppForPath()` returns longest-prefix match
- [x] `shell/lib/mf/use-shell-routing.ts`: `useShellRouting(apps)` hook resolves the matching app for current pathname, lazy-loads `AppEntry` via runtime script federation
- [x] `shell/lib/mf/load-remote.ts`: `loadRemoteModule()` injects remote entry script and initialises MF container
- [x] **Acceptance:** Hook resolves correct remote for a given pathname; unmatched routes return null

#### M8-3: Child app mount page
- [x] `app/(shell)/[...slug]/page.tsx` (Server Component): fetches apps + session, passes to `ChildAppHost`
- [x] `app/(shell)/[...slug]/child-app-host.tsx` (Client Component): renders `AppEntry` wrapped in `AppErrorBoundary` + `Suspense`
- [x] `shell/components/shell/app-skeleton.tsx`: loading placeholder matching shell layout dimensions
- [x] `shell/components/shell/app-error-view.tsx`: error UI scoped to content area; sidebar and header unaffected
- [x] `shell/components/shell/error-boundary.tsx`: `AppErrorBoundary` class component
- [x] **Acceptance:** Navigating to a registered route loads `AppEntry`; crash in child app shows `AppErrorView` only

#### M8-4: ShellSDKProvider wrapper
- [x] `shell/components/shell/shell-sdk-provider.tsx`: wraps `AppEntry` in `ShellContext.Provider` with `user`, `navigate` (router.push), `theme` (next-themes)
- [x] `packages/shell-sdk/`: `@corp/shell-sdk` — `ShellContext`, `useShellUser`, `useShellNavigate`, `useShellTheme`, `ShellEventBus`, tailwind preset
- [x] **Acceptance:** `useShellUser()` inside a child app returns correct user data; `useShellTheme()` returns current theme

#### M8-5: End-to-end MF smoke test
- [x] `packages/test-child-app/`: exposes `AppEntry` that renders user email from `useShellUser()`; webpack 5 + Module Federation config; `public/mf-manifest.json`
- [x] Register in dev Admin Panel at routePrefix `/test-app`; loads in `[...slug]` route
- [x] **Acceptance:** Test child app renders user email via SDK hook; ErrorBoundary catches a manually thrown error

---

## M9 — Shell SDK & CLI

**Goal:** `@corp/shell-sdk` is published to GitHub Packages and usable by child app teams. `@corp/create-shell-app` CLI scaffolds a ready-to-deploy child app project.

### Tasks

#### M9-1: Shell SDK — hooks and event bus
- [x] `packages/shell-sdk/src/hooks/useShellUser.ts`
- [x] `packages/shell-sdk/src/hooks/useShellNavigate.ts`
- [x] `packages/shell-sdk/src/hooks/useShellTheme.ts`
- [x] `packages/shell-sdk/src/events/ShellEventBus.ts`: `emit`, `on`, `off` typed event system
- [x] `packages/shell-sdk/src/tailwind/preset.ts`: exports shared color/spacing tokens
- [x] TypeScript build (`tsc --declaration`); `package.json` with `exports` map
- [x] **Acceptance:** All hooks and event bus export with correct TypeScript types; `pnpm --filter shell-sdk build` passes

#### M9-2: Shell SDK — publish pipeline
- [x] `.github/workflows/publish-sdk.yml`: trigger on tag `shell-sdk/v*.*.*`
- [x] Steps: build → `npm publish --access restricted` with `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
- [x] Package name: `@corp/shell-sdk` on GitHub Packages
- [x] **Acceptance:** Tagged release publishes package; `npm install @corp/shell-sdk` resolves from GitHub Packages

#### M9-3: Create-shell-app CLI — scaffolder (`new` subcommand)
- [x] `packages/create-shell-app/src/index.ts`: reads `<app-name>` arg under `new` subcommand, copies `template/` with substitutions
- [x] Template contents:
  - React 18 + TypeScript + Webpack 5
  - Module Federation remote config (pre-filled `name`, `filename: 'remoteEntry.js'`)
  - `AppEntry.tsx` stub
  - `mf-manifest.json` template
  - `@corp/shell-sdk` pre-installed in template `package.json`
  - `.github/workflows/deploy.yml`: build → S3 sync → CloudFront invalidation
  - `README.md` with registration walkthrough
- [x] **Acceptance:** `npx @corp/create-shell-app new my-app` creates a valid project; `cd my-app && pnpm install && pnpm build` succeeds

#### M9-4: Create-shell-app — publish pipeline
- [x] `.github/workflows/publish-cli.yml`: trigger on tag `create-shell-app/v*.*.*`
- [x] Published as `@corp/create-shell-app` on GitHub Packages
- [x] **Acceptance:** `npx @corp/create-shell-app` resolves from GitHub Packages after publish

---

## M10 — Subscription & Entitlement Engine

**Goal:** Subscription tier gates work end-to-end: restricted routes show Upgrade Prompt, admin can change tiers, and the webhook endpoint applies tier changes immediately.

### Tasks

#### M10-1: Subscription gate in middleware and Server Component
- [x] Middleware: for routes with `requiredSubLevel > 0`, check `session.subscriptionLevel`; if insufficient, redirect to `/upgrade?from={route}`
- [x] `app/(shell)/upgrade/page.tsx`: renders Upgrade Prompt content from `subscription_tiers.upgradeCta` / `upgradeUrl` for the required tier
- [x] **Acceptance:** User with `free` tier accessing a `standard` route sees Upgrade Prompt; `standard` user passes through

#### M10-2: Subscription expiry enforcement
- [x] In NextAuth.js `jwt()` callback: if `user_subscriptions.expiresAt` is in the past, downgrade to `free` tier and update DB
- [x] **Acceptance:** User with expired subscription gets `free` tier on next login; DB updated

#### M10-3: Webhook endpoint
- [x] `POST /api/internal/subscriptions/assign`:
  - Validate `X-Webhook-Signature` header (HMAC-SHA256 with `WEBHOOK_SECRET` from Secrets Manager, constant-time compare)
  - Payload: `{ userId, tierId, expiresAt? }`
  - Write to `user_subscriptions`
  - Return 200; invalid signature returns 401
- [x] **Acceptance:** Valid signed request updates user tier; unsigned/wrong-signature request returns 401; no timing attack surface

---

## M11 — Observability & Security Hardening

**Goal:** Structured logs flow to CloudWatch; request traces are correlated; CSP headers are set; all NFR security requirements are verified.

### Tasks

#### M11-1: Structured logging
- [x] `shell/lib/logger.ts`: thin wrapper that outputs `JSON.stringify({ level, message, traceId, ...meta })` to stdout (CloudWatch captures Lambda stdout automatically)
- [x] Attach trace ID (from `instrumentation.ts`) to every log line
- [x] Replace any `console.log` calls in API handlers with the logger
- [x] **Acceptance:** CloudWatch Log Insights query on `traceId` returns all log lines for a single request

#### M11-2: Request tracing
- [x] `shell/instrumentation.ts`: X-Ray native tracing; trace ID read from `_X_AMZN_TRACE_ID` env var injected by the Lambda runtime (Amplify-managed)
- [x] Propagate trace context through API route handlers
- [x] **Acceptance:** X-Ray service map shows shell Lambda and PostgreSQL as connected nodes

#### M11-3: CSP and security headers
- [x] Next.js `headers()` in `next.config.ts`:
  - `Content-Security-Policy`: restrict script/style/connect sources; allow child app CloudFront origins explicitly
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=()`
- [x] **Acceptance:** Security headers present on all responses; CSP does not block shell or registered child app assets

#### M11-4: Security checklist verification
- [x] Walk through `ARCHITECTURE.md §12` security table; verify each row is implemented
- [x] Confirm: no secrets in source, HMAC webhook validation, no `localStorage` token storage, admin routes server-checked, `super_admin` lockout prevention active
- [x] **Acceptance:** All items in the security table have a corresponding passing implementation or test

---

## M12 — Performance & Load Validation

**Goal:** All NFR performance and availability targets are verified before v1 launch.

### Tasks

#### M12-1: Shell load time baseline (P95 < 2s)
- [x] Enable CloudWatch RUM on the shell CloudFront distribution
- [x] Measure P95 LCP from 50 simulated users on 10 Mbps throttled connection
- [x] Identify and fix any asset bundle size issues (code splitting, dynamic imports)
- [x] **Acceptance:** P95 shell initial load < 2 seconds confirmed in CloudWatch RUM

#### M12-2: Child app MF cold load baseline (P95 < 1.5s)
- [x] Measure time from navigation to `AppEntry` render-complete for a registered test child app
- [x] Optimize `remoteEntry.js` bundle size if needed
- [x] **Acceptance:** P95 MF cold load < 1.5 seconds confirmed

#### M12-3: Load test at 1,000 concurrent sessions
- [x] Run k6 or Artillery load test: 1,000 virtual users, authenticated sessions, mixed navigation and API calls
- [x] Monitor PostgreSQL ACU scaling, Lambda concurrency, and CloudFront cache hit rate
- [x] **Acceptance:** Zero 5xx errors; P99 API response < 500ms; PostgreSQL stays within 2 ACU; Lambda concurrency headroom > 20%

#### M12-4: Availability smoke test
- [x] Route 53 health check configured for `app.corp.com`
- [x] Simulate Lambda cold start surge; verify < 1% cold start impact on P95
- [x] **Acceptance:** Health check passes; 99.9% availability target met over 72-hour observation window

---

## M13 — Notifications System

**Goal:** Users see a bell icon with unread badge in the header. New notifications are pushed in real time via SSE as toasts. Admins create/manage notifications from `/admin/notifications`. Child apps push notifications by calling `POST /api/notifications` directly with the SSO session cookie.

### Tasks

#### M13-1: DB schema — notifications tables
- [x] Add `notifications` table to `shell/lib/db/schema.ts`: `id`, `title`, `body`, `actionLabel`, `actionType`, `actionPayload`, `targetType`, `targetUserId` (FK → users), `targetSubLevel`, `expiresAt`, `createdBy` (FK → users), `createdAt`
- [x] Add `notificationReads` table: `notificationId` (FK → notifications, cascade delete), `userId` (FK → users, cascade delete), `readAt`; PK `(notificationId, userId)`
- [x] Update existing migration file in place (no new migration file)
- [x] **Acceptance:** Migration runs; both tables exist in DB with correct constraints

#### M13-2: User-facing API routes
- [x] `GET /api/notifications`: returns paginated visible, non-expired notifications for current user with `isRead` per row; applies visibility logic (targetType + expiry)
- [x] `POST /api/notifications`: creates notification from request body; `createdBy` set from session; triggers SSE push to eligible connected users; returns `{ id }`; usable by any authenticated user including child apps
- [x] `POST /api/notifications/read`: body `{ notificationId: string | "all" }` — upserts rows in `notification_reads`; returns updated unread count
- [x] `GET /api/notifications/stream`: SSE endpoint; registers controller in module-level registry; sends `notification` events; sends `": ping"` comment every 30s; cleans up on disconnect
- [x] **Acceptance:** List returns correct items for user; create returns 201 with id; read marks correctly; SSE connection stays open and receives test event

#### M13-3: Admin API routes
- [x] `GET /api/admin/notifications`: paginated list of all notifications with read count per notification; requires `admin` or `super_admin` via `requireRoles()`
- [x] `POST /api/admin/notifications`: creates notification from request body; triggers SSE push to eligible connected users; returns created record
- [x] `DELETE /api/admin/notifications/[id]`: hard deletes notification (cascade removes read records); requires admin role
- [x] **Acceptance:** Create returns 201 with id; delete returns 204; unauthorized request returns 403

#### M13-4: Zustand store additions
- [x] Add `unreadCount: number`, `setUnreadCount(n: number)`, `incrementUnreadCount()` to `shell/lib/store/shell-store.ts`
- [x] **Acceptance:** `useShellStore()` exposes new fields without TypeScript errors

#### M13-5: NotificationProvider
- [x] `shell/components/shell/notifications/notification-provider.tsx`: Client component; opens `EventSource` to `/api/notifications/stream` on mount; reconnects with exponential backoff (1s → 2s → 4s … max 30s); on `notification` event: appends toast to local state, calls `incrementUnreadCount()`
- [x] Exposes `useNotifications()` hook: `{ notifications, unreadCount, markRead, markAllRead, refresh }`
- [x] Wrap `ShellLayoutClient` (or equivalent) with `NotificationProvider` in `shell/app/(shell)/layout.tsx`
- [x] Initial unread count loaded from `GET /api/notifications` on mount; stored in Zustand
- [x] **Acceptance:** Provider mounts without errors; SSE reconnects after simulated disconnect

#### M13-6: NotificationBell + NotificationDropdown
- [x] `shell/components/shell/notifications/notification-bell.tsx`: Ghost `Button` (size `icon`) with `Bell` from lucide-react; absolute-positioned red badge showing `unreadCount` (hidden when 0, `99+` when > 99); wraps `NotificationDropdown` in `DropdownMenu`
- [x] Replace `<div data-shell-notifications />` in `shell/components/shell/header.tsx` with `<NotificationBell />`
- [x] `shell/components/shell/notifications/notification-dropdown.tsx`: 320px wide, max-height 480px; header row with "Notifications" + "Mark all read"; All/Unread tabs (client-side filter); per-row: dot indicator, bold/muted title, 2-line body, relative timestamp, action link; empty state; loading skeleton
- [x] **Acceptance:** Bell appears in header; badge shows/hides correctly; dropdown opens with correct items; clicking row marks read

#### M13-7: NotificationToast
- [x] `shell/components/shell/notifications/notification-toast.tsx`: fixed bottom-right; toasts stack upward; max 3 simultaneous (oldest dismissed on 4th); each toast: bell icon, title, body (truncated), optional action link, × button; auto-dismiss after 5s
- [x] No external toast library — local React state in `NotificationProvider`
- [x] **Acceptance:** Toast appears on SSE event; auto-dismisses at 5s; × dismisses immediately; 4th toast displaces oldest

#### M13-8: Admin notifications page
- [x] `shell/app/(shell)/admin/notifications/page.tsx`: table of all notifications (title, target, expires, created, delete action); "Create notification" button opens dialog/sheet with fields: title, body, target type (All/User/Subscription select), conditional target user search or min sub level, optional action group (label + type + payload), optional expires at datetime
- [x] Add `"/admin/notifications": "Notifications"` to `ADMIN_ROUTE_LABEL_MAP`
- [x] Server-side role guard via `requireRoles(["admin", "super_admin"])` in the page
- [x] **Acceptance:** Admin can create notification; notification appears in table; delete removes it; non-admin role cannot access page

---

## M14 — Open-Source Readiness

**Goal:** The shell runs without any AWS account via Docker Compose + local env vars. KMS and S3 each have local fallbacks. Repo has OSS contribution infrastructure. Core security-critical paths have Vitest test coverage.

**Depends on:** M1–M13 complete.

---

### Tasks

#### M14-1: CryptoProvider abstraction (Gap 1)

- [x] Create `shell/lib/crypto.ts`: export `CryptoProvider` interface `{ encrypt(plaintext: string): Promise<string>; decrypt(ciphertext: string): Promise<string> }`; `KmsCryptoProvider` (delegates to existing `lib/kms.ts`; activated when `ENCRYPTION_PROVIDER=kms` or `KMS_KEY_ID` is set); `LocalCryptoProvider` (AES-256-GCM via `node:crypto`, reads `ENCRYPTION_KEY` (64 hex chars), per-value random IV, output format `local:<iv_hex>:<ct_hex>:<tag_hex>`); `getProvider()` factory selecting on env at module load; top-level `encrypt()` and `decrypt()` exports
- [x] Update `shell/lib/kms.ts`: re-export `encrypt`/`decrypt` from `crypto.ts` for backwards compatibility
- [x] Update `shell/app/api/setup/complete/route.ts`: call `encrypt()` from `lib/crypto.ts` instead of `kmsEncrypt()` directly
- [x] Update `shell/lib/auth.ts:getOidcConfig()`: call `decrypt()` from `lib/crypto.ts` instead of `kmsDecrypt()` directly
- [x] Update `shell/.env.local.example`: document `ENCRYPTION_KEY` and `ENCRYPTION_PROVIDER` entries with instructions
- [x] **Acceptance:**
  - `ENCRYPTION_PROVIDER=local ENCRYPTION_KEY=<64-hex-chars>`: wizard completes; OIDC secret stored as `local:...` ciphertext; auth flow decrypts correctly
  - `ENCRYPTION_PROVIDER=kms KMS_KEY_ID=<arn> AWS_REGION=<region>`: existing KMS behavior unchanged
  - Starting the app with neither `KMS_KEY_ID` nor `ENCRYPTION_KEY` set logs a clear startup error and refuses to start

#### M14-2: StorageProvider abstraction (Gap 2)

- [x] Create `shell/lib/storage.ts`: export `StorageProvider` interface `{ upload(filename: string, contentType: string, data?: Buffer): Promise<{ uploadUrl?: string; publicUrl: string }> }`; `S3StorageProvider` (existing presigned PUT logic; activated when `STORAGE_PROVIDER=s3` or `AWS_S3_BUCKET` set); `LocalStorageProvider` (writes file to `public/uploads/logos/<filename>`, returns `{ publicUrl: '/uploads/logos/<filename>' }`); `getProvider()` factory
- [x] Update `shell/app/api/setup/upload-logo/route.ts`: delegate to `storage.ts` provider
- [x] Update `shell/app/(shell)/admin/branding` upload API handler: consolidate existing duplicated S3 presign logic into `storage.ts`
- [x] Update `shell/app/setup/page.tsx`: if `uploadUrl` absent in response, POST file directly (multipart); if present, PUT to presigned URL
- [x] Add `public/uploads/.gitkeep`; add `public/uploads/logos/` to `.gitignore`
- [x] **Acceptance:**
  - `STORAGE_PROVIDER=local` (no `AWS_S3_BUCKET`): wizard step 1 uploads logo; logo appears at `/uploads/logos/<filename>`; `shell_config.logoUrl` contains the relative path
  - `STORAGE_PROVIDER=s3` (with `AWS_S3_BUCKET` set): existing presigned-PUT S3 behavior unchanged
  - Branding re-upload in Admin Panel → Theme uses the same storage abstraction

#### M14-3: Docker Compose + env documentation (Gaps 3, 4, 5)

- [x] Add `docker-compose.yml` at repo root: `postgres:15-alpine`, `POSTGRES_DB/USER/PASSWORD=corpshell`, port 5432, named volume `postgres_data`
- [x] Update `shell/.env.local.example`: add `DATABASE_URL=postgresql://corpshell:corpshell@localhost:5432/corpshell` as the default local value; add comment clarifying `DATABASE_URL` and `NEXTAUTH_SECRET` are plain env vars (Secrets Manager is only for Amplify production); move RUM env vars (`NEXT_PUBLIC_RUM_APP_MONITOR_ID`, `NEXT_PUBLIC_RUM_GUEST_ROLE_ARN`, `NEXT_PUBLIC_RUM_IDENTITY_POOL_ID`) to a clearly marked `# Optional: AWS CloudWatch RUM (omit for local dev)` section
- [x] Remove unused `@aws-sdk/client-secrets-manager` from `shell/package.json` (never imported in code)
- [x] Update `shell/lib/logger.ts` to read a generic `TRACE_ID` env var before falling back to `_X_AMZN_TRACE_ID`
- [x] **Acceptance:**
  - `docker compose up -d` starts Postgres at localhost:5432 with the `.env.local.example` connection string
  - App starts with only `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` set; no AWS credentials or Secrets Manager access needed

#### M14-4: Conditional CSP for S3 origins (Gap 6)

- [x] Update `shell/next.config.ts`: make `img-src`, `connect-src`, and `script-src` S3/CloudFront entries conditional on `process.env.AWS_S3_BUCKET` being set (same pattern as existing RUM script origin conditional)
- [x] **Acceptance:**
  - `AWS_S3_BUCKET` unset: S3 CloudFront origin absent from CSP; no console CSP violations in local dev
  - `AWS_S3_BUCKET` set: S3 CloudFront origin present in CSP; existing production behavior unchanged

#### M14-5: OSS DX files (Gap 7)

- [x] Create `CONTRIBUTING.md`: local dev setup (Docker Compose → `.env.local` → `pnpm dev`), branching model (feature branches → PR to `main`), PR checklist, coding conventions (TypeScript strict, ESLint, Prettier), how to run tests (`pnpm test`)
- [x] Create `.github/ISSUE_TEMPLATE/bug_report.md`: fields for environment, steps to reproduce, expected vs. actual behavior, logs
- [x] Create `.github/ISSUE_TEMPLATE/feature_request.md`: fields for problem statement, proposed solution, alternatives considered
- [x] Create `.github/PULL_REQUEST_TEMPLATE.md`: sections for summary, test plan, breaking changes, checklist (tests pass, types pass, lint passes)
- [x] Create `CHANGELOG.md`: semantic versioning format; initial entry for v1.0.0 listing M1–M13 features
- [x] Rewrite `README.md` "Getting started" section: local-first path as primary; AWS/Amplify as secondary; link to `CONTRIBUTING.md` for contributor setup
- [x] **Acceptance:**
  - New contributor can reach the setup wizard following only the README "Getting started" section; no steps require AWS credentials
  - `CONTRIBUTING.md` covers all steps needed to run tests locally

#### M14-6: Vitest test suite (Gap 8)

- [x] Add `shell/vitest.config.ts`: configure Vitest for the `shell/` workspace; path aliases matching `tsconfig.json`; environment `node`
- [x] Add `pnpm --filter shell test` script to `shell/package.json`; add root `pnpm test` script that delegates to shell
- [x] Create `shell/tests/crypto.test.ts`:
  - Local provider: `encrypt` then `decrypt` round-trip returns original plaintext
  - Local provider: two calls produce different ciphertexts (IV randomness)
  - Local provider: output starts with `local:`
  - Local provider: tampered ciphertext throws on decrypt (GCM auth tag verification)
  - Provider selection: `ENCRYPTION_PROVIDER=local` selects local; `ENCRYPTION_PROVIDER=kms` selects KMS (mock KMS client)
- [x] Create `shell/tests/auth.test.ts` (mock Drizzle client):
  - JIT provisioning: new user email inserts user row, role rows, subscription row
  - Existing user: `lastLoginAt` updated; no duplicate rows
  - Subscription expiry: expired subscription downgrades to `free` tier in the JWT
  - Group mapping: IDP group mapped to shell role appears in JWT `roles[]`
- [x] Create `shell/tests/middleware.test.ts`:
  - Setup not complete: any non-`/setup` path redirects to `/setup`
  - Setup complete: `/setup` returns 404
  - No session: protected route redirects to `/api/auth/signin`
  - Session with `admin` role: `/admin/menu` passes through
  - Session without `admin` role: `/admin/menu` returns 403
- [x] Create `shell/tests/setup-complete.test.ts` (mock Drizzle client):
  - Idempotency: second POST to `/api/setup/complete` after `setup_complete = true` returns 400
  - Atomic write: if any INSERT fails, transaction rolls back (no partial state)
  - Encrypts OIDC client secret before writing (verifies ciphertext != plaintext in DB)
- [x] **Acceptance:** `pnpm --filter shell test` passes all tests with zero failures

---

### M14 Launch Criteria

Before marking M14 complete:

- [x] `git clone` on a machine with zero AWS credentials → `docker compose up -d` → fill `.env.local` → `pnpm dev` → `/setup` wizard reachable with no errors
- [x] Wizard completes end-to-end in local mode (local crypto + local storage)
- [x] `pnpm --filter shell test` passes with zero failures
- [x] Switching to AWS mode (`ENCRYPTION_PROVIDER=kms`, `STORAGE_PROVIDER=s3`, real credentials) works without code changes
- [x] All Gap 7 files present and reviewed

---

## Launch Checklist

Before marking v1 as released, confirm:

- [x] All M1–M12 acceptance criteria passed
- [ ] `/setup` returns 404 in production
- [ ] `super_admin` account verified and secured
- [ ] All secrets in Secrets Manager; zero secrets in git or Lambda env vars (only ARN references)
- [ ] CloudWatch alarms configured for error rate, PostgreSQL ACU, and Lambda throttling
- [ ] `@corp/shell-sdk` v1.0.0 published to GitHub Packages
- [ ] At least one child app successfully onboarded end-to-end (< 2 hours)
- [ ] Cost Explorer tag `project=corp-shell` shows < $100/month in production
- [ ] M14 launch criteria all pass (local dev path verified end-to-end)
- [ ] `CONTRIBUTING.md` and issue templates present and reviewed

---

## M15 — Shell as Distributable Package

**Goal:** Publish `src/shell` as `@corp/shell-app` to GitHub Packages and extend `create-shell-app` with `init` and `update` subcommands so operators can provision and update shell instances without forking the repository.

**Depends on:** M9 (SDK & CLI), M14 (OSS readiness / local dev)

**Status:** Complete

### Tasks

#### M15-1: Prepare `src/shell` for publication
- [x] Set `"name": "@corp/shell-app"` and `"private": false` in `src/shell/package.json`
- [x] Add `"files"` array to `src/shell/package.json` (see ARCHITECTURE.md §15.5)
- [x] Add `shell-app/vX.Y.Z` tag format and release process to `CONTRIBUTING.md`
- [x] **Acceptance:** `pnpm --filter @corp/shell-app pack --dry-run` lists only source files; no `.next/` or `node_modules/`

#### M15-2: GitHub Actions publish workflow
- [x] Create `.github/workflows/publish-shell-app.yml`
- [x] Trigger: tag `shell-app/vX.Y.Z`
- [x] Steps: checkout → pnpm install → `pnpm --filter @corp/shell-app build` (validates source compiles) → `npm publish --access restricted`
- [x] **Acceptance:** Pushing tag `shell-app/v1.0.0` publishes `@corp/shell-app@1.0.0` to GitHub Packages

#### M15-3: `create-shell-app init` subcommand
- [x] Refactor `packages/create-shell-app/src/index.ts` to route `init`, `update`, `new` subcommands
- [x] `init <name>`: downloads `@corp/shell-app` from GitHub Packages, extracts source tree to `./<name>/`, writes `./<name>/.shell-version`
- [x] Existing default behaviour (scaffold child app) moves to `new <name>` subcommand
- [x] **Acceptance:** `npx @corp/create-shell-app init my-shell` creates a directory with full shell source and `.shell-version` file; `npx @corp/create-shell-app new my-app` still scaffolds a child app project

#### M15-4: `create-shell-app update` subcommand
- [x] `update [--version X.Y.Z]`: reads `.shell-version` from CWD, downloads target `@corp/shell-app` version, fully overwrites shell source files, updates `.shell-version`
- [x] Prints list of overwritten files and post-update instructions (`pnpm install`, `pnpm drizzle-kit migrate`)
- [x] **Acceptance:** Running `update --version 1.1.0` in a provisioned instance replaces all shell files and updates `.shell-version` to `1.1.0`

#### M15-5: CLI publish pipeline update
- [x] Update `publish-cli.yml` to build and publish `@corp/create-shell-app` with the new subcommands
- [x] Bump `create-shell-app` version to `1.0.0` (breaking change: bare `npx @corp/create-shell-app <name>` removed)
- [x] **Acceptance:** `npx @corp/create-shell-app --help` shows `init`, `update`, `new` subcommands

#### M15-6: Documentation
- [x] Update `README.md` "Getting started" to show `init` as the primary provisioning path
- [x] Update `CONTRIBUTING.md` with versioning and release process for `@corp/shell-app`
- [x] **Acceptance:** A new operator can provision a shell instance using only the README without reading source code

---

---

---

## v2 Milestones (M16–M19)

> **v2 implementation begins after M15 is complete and shipped.** The design for M16–M19 is documented here ahead of implementation. Sections §1–§19 of `ARCHITECTURE.md` remain the authoritative description of the running system; §20 documents the v2 design.

---

## M16 — Multi-Tenant Data Model

**Goal:** PostgreSQL schema-per-tenant is in place. `withTenant(slug)` returns a Drizzle client scoped to `tenant_{slug}`. `provisionTenant()` creates a new tenant schema and seeds it with defaults. All existing v1 queries continue to work, now routed through the tenant client.

**Depends on:** M15 complete.

**Status:** Complete

### Tasks

#### M16-1: Schema changes — `public.tenants` + per-tenant tables
- [x] In `src/shell/lib/db/schema.ts`:
  - Add `pgEnum("tenant_status", ["active", "suspended", "deleted"])`
  - Add `pgEnum("subscription_status", ["active", "trialing", "past_due", "canceled"])`
  - Add `public.tenants` table: `id` (uuid PK defaultRandom), `slug` (text unique not null), `displayName` (text not null), `status` (tenant_status not null default "active"), `createdAt` (timestamp defaultNow)
  - Add `idpProviders` table (per-tenant schema): `id` (uuid PK), `displayName` (text), `issuer` (text), `clientId` (text), `encryptedClientSecret` (text), `scopes` (text[]), `groupClaimName` (text), `isEnabled` (boolean default true), `createdAt` (timestamp defaultNow)
  - Add `tenantSubscription` table (per-tenant schema): `tierId` (uuid FK → subscriptionTiers.id), `status` (subscription_status not null default "active"), `expiresAt` (timestamp nullable), `assignedAt` (timestamp defaultNow)
  - Remove `userSubscriptions` table definition
- [x] Update existing migration file in place (no new migration file)
- [x] **Acceptance:** `pnpm drizzle-kit generate` produces valid SQL; no TypeScript errors in schema file

#### M16-2: Export `connectionString` from `client.ts`
- [x] In `src/shell/lib/db/client.ts`, export the raw `connectionString` string used to construct the `postgres()` client
- [x] **Acceptance:** `import { connectionString } from "~/lib/db/client"` resolves without circular dependency

#### M16-3: `withTenant(slug)` Drizzle client factory
- [x] Create `src/shell/lib/db/tenant.ts`:
  ```typescript
  import postgres from "postgres";
  import { drizzle } from "drizzle-orm/postgres-js";
  import { connectionString } from "~/lib/db/client";
  import * as schema from "~/lib/db/schema";

  export function withTenant(slug: string) {
    const client = postgres(connectionString, {
      connection: { search_path: `tenant_${slug},public` },
    });
    return drizzle(client, { schema });
  }
  ```
- [x] **Acceptance:** `withTenant("acme")` returns a typed Drizzle client; querying `users` table reads from `tenant_acme.users`

#### M16-4: `provisionTenant()` provisioning function
- [x] Create `src/shell/lib/db/provision.ts`:
  - `provisionTenant(slug: string, displayName: string, adminEmail: string)`:
    1. Validate `slug` matches `/^[a-z0-9-]+$/` — throw if invalid
    2. Check `public.tenants` for slug uniqueness — throw if taken
    3. `INSERT public.tenants`
    4. `CREATE SCHEMA tenant_{slug}` (raw SQL via `postgres()`)
    5. Run DDL for all per-tenant tables against `tenant_{slug}` schema (using `withTenant(slug)`)
    6. Seed: `shellConfig` (setup_complete=true, default branding), `subscriptionTiers` (free level 0, standard level 1, enterprise level 2), `roles` (super_admin isSystem=true, admin), initial admin `users` row (email=adminEmail, isActive=true), `userRoles` (super_admin → admin user), `tenantSubscription` (free tier, status=active)
    7. Return the created tenant record
- [x] **Acceptance:** Calling `provisionTenant("acme", "Acme Corp", "admin@acme.com")` creates `tenant_acme` schema with all tables and seed data; re-calling with same slug throws

#### M16-5: Fix broken imports after `userSubscriptions` removal
- [x] Update `src/shell/lib/auth.ts`: remove `userSubscriptions` query; replace with `tenantSubscription` query via `withTenant(tenantSlug)` (tenantSlug not yet in JWT at this step — reads from env `TENANT_SLUG` or hardcoded for single-tenant compat until M17)
- [x] Update `src/shell/app/api/internal/subscriptions/assign/route.ts`: change payload from `{ userId, tierId, expiresAt? }` to `{ tenantSlug, tierId, expiresAt? }`; write to `tenantSubscription` via `withTenant(tenantSlug)`
- [x] **Acceptance:** `pnpm typecheck` passes; `pnpm --filter shell build` succeeds; existing tests pass

---

## M17 — Subdomain Routing + Tenant JWT

**Goal:** The middleware extracts the tenant slug from the Host header at the login boundary and does nothing with it for authenticated requests beyond asserting `token.tenantSlug === host-slug`. The signed JWT carries `tenantId` and `tenantSlug` from login onward. Cross-tenant token replay returns 401.

**Depends on:** M16 complete.

**Status:** Complete

### Tasks

#### M17-1: `getTenantSlug()` utility
- [x] Create `src/shell/lib/tenant-resolver.ts`:
  - Reads `TENANT_SLUG` env var override first
  - Splits host on `.`, returns first segment as subdomain
  - Returns `null` for single-part hostnames; handles `*.localhost` for local dev
- [x] **Acceptance:** `getTenantSlug("acme.corp.com")` returns `"acme"`; `TENANT_SLUG=acme` env override returns `"acme"` regardless of host

#### M17-2: Extend NextAuth session types
- [x] Create or update `src/shell/types/next-auth.d.ts`:
  - Add `tenantId: string` and `tenantSlug: string` to the `JWT` interface
  - Add `tenantId: string` and `tenantSlug: string` to the `Session.user` interface
- [x] **Acceptance:** `token.tenantSlug` and `session.user.tenantSlug` are typed without `any` cast

#### M17-3: Write `tenantId` + `tenantSlug` into JWT in `auth.ts`
- [x] In `src/shell/lib/auth.ts` `jwt()` callback:
  - At login trigger: read `tenantSlug` from `getTenantSlug(req.headers.host)`
  - Look up `public.tenants` by slug (global `db`, not `withTenant`) → get `tenantId`
  - Write `token.tenantId = tenant.id` and `token.tenantSlug = tenant.slug`
  - Read `tenantSubscription` via `withTenant(slug)` → write `subscriptionTier` + `subscriptionLevel` to JWT
- [x] **Acceptance:** After login on `acme.corp.com`, the decoded JWT contains `tenantId` and `tenantSlug = "acme"`

#### M17-4: Middleware — host-based login boundary + cross-tenant check
- [x] In `src/shell/proxy.ts` (middleware):
  - Unauthenticated login paths (`/login`, `/api/auth/**`): call `getTenantSlug(host)` → check `public.tenants` → 404 if not found → redirect `/suspended` if status=suspended
  - Authenticated paths: decode JWT → assert `token.tenantSlug === getTenantSlug(host)` → 401 if mismatch
  - Suspended tenant check on authenticated path: if `public.tenants.status === "suspended"` → redirect `/suspended` (check infrequently via short JWT-embedded flag or single DB lookup)
- [x] **Acceptance:** Token minted for `acme` is rejected with 401 on `globocorp.corp.com`; suspended tenant redirects to `/suspended`

#### M17-5: `/suspended` page
- [x] Create `src/shell/app/suspended/page.tsx`: static page showing account suspended message — no auth required, no sidebar
- [x] **Acceptance:** Navigating to `/suspended` renders the page without a login redirect loop

#### M17-6: CloudFront wildcard DNS (documentation)
- [x] Add `docs/ops/wildcard-dns-setup.md`:
  - Route 53: `*.corp.com` ALIAS → existing CloudFront distribution
  - ACM: request wildcard cert `*.corp.com` in `us-east-1`; validate via DNS
  - CloudFront: add `*.corp.com` as alternate domain name; attach wildcard cert
  - Amplify: no change (CloudFront routes to same origin)
- [x] **Acceptance:** Doc reviewed; DNS change applied in staging; `acme.corp.com` and `globocorp.corp.com` both resolve to the shell

---

## M18 — Dynamic IDP Registration

**Goal:** Each tenant manages its own OIDC provider(s) via the Admin Panel. `getAuthConfig(tenantSlug)` loads enabled providers from the `idpProviders` table at login time. The NextAuth factory pattern re-configures auth per request.

**Depends on:** M17 complete.

**Status:** Complete

### Tasks

#### M18-1: `getAuthConfig(tenantSlug)` in `lib/auth-config.ts`
- [x] Create `src/shell/lib/auth-config.ts`:
  ```typescript
  import { withTenant } from "~/lib/db/tenant";
  import * as schema from "~/lib/db/schema";
  import { decrypt } from "~/lib/crypto";
  import { eq } from "drizzle-orm";
  import type { NextAuthConfig } from "next-auth";

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
- [x] **Acceptance:** `getAuthConfig("acme")` returns a valid `NextAuthConfig` with providers populated from `tenant_acme.idpProviders`

#### M18-2: Replace `getOidcConfig()` in `auth.ts` with factory pattern
- [x] Update `src/shell/lib/auth.ts` to use the NextAuth v5 factory pattern:
  ```typescript
  import { getAuthConfig } from "~/lib/auth-config";
  import { getTenantSlug } from "~/lib/tenant-slug";

  export const { handlers, auth, signIn, signOut } = NextAuth(async (req) => {
    const slug = getTenantSlug(req?.headers?.get("host") ?? "");
    const config = await getAuthConfig(slug);
    return {
      ...config,
      callbacks: {
        jwt: async ({ token, account, profile }) => {
          // existing JWT callback logic (tenant fields added in M17-3)
          return token;
        },
      },
    };
  });
  ```
- [x] Remove the old `getOidcConfig()` function and `cachedConfig` variable
- [x] **Acceptance:** `pnpm typecheck` passes; login flow works end-to-end with providers from DB

#### M18-3: SSO Admin API — multi-IDP CRUD
- [x] Update `src/shell/app/api/admin/sso/route.ts` to support:
  - `GET /api/admin/sso` → list all `idpProviders` for the tenant (clientSecret omitted from response)
  - `POST /api/admin/sso` → create new provider; validate `issuer/.well-known/openid-configuration` before insert; encrypt clientSecret; return created record (without secret)
  - `PATCH /api/admin/sso/[id]` → update provider fields; re-validate issuer if changed; re-encrypt secret if changed
  - `DELETE /api/admin/sso/[id]` → delete provider (hard delete)
  - All routes: `requireRoles(["super_admin", "admin"])`; use `withTenant(token.tenantSlug)` for DB access
- [x] On save: `fetch(`${issuer}/.well-known/openid-configuration`)` — return 400 with error detail if non-200 or invalid JSON
- [x] **Acceptance:** POST with valid issuer persists record; POST with unreachable issuer returns 400; secret in DB is ciphertext not plaintext

#### M18-4: SSO Admin UI — multi-IDP list and form
- [x] Update `src/shell/app/(shell)/admin/sso/page.tsx`:
  - Replace single-provider read-only view with a list of configured providers (name, issuer, enabled toggle, edit/delete actions)
  - "Add IDP" button opens a sheet/dialog: fields for displayName, issuer, clientId, clientSecret (password input), scopes (comma-separated), groupClaimName, isEnabled toggle
  - "Test Connection" button calls the discovery validation before submitting
  - Edit: pre-fill form (clientSecret field shows placeholder, not actual value)
  - Delete: confirmation dialog
- [x] **Acceptance:** Admin can add, toggle, edit, and delete IDP providers; invalid issuer shows inline error; secret never echoed back in the UI

---

## M19 — Platform Admin Tenant Management

**Goal:** Platform super admins manage all tenants from `https://platform.corp.com/platform/tenants`. They can create new tenants, suspend, and soft-delete them. The org-level subscription model is fully wired: `tenantSubscription` is the authoritative source; the webhook updates it at the tenant level.

**Depends on:** M16, M17, M18 complete.

**Status:** Complete

### Tasks

#### M19-1: Bootstrap platform tenant
- [x] Create `src/shell/scripts/bootstrap-platform.ts` (run once, not part of app startup):
  - Check if `tenant_platform` schema exists — exit if already bootstrapped
  - Call `provisionTenant("platform", "Platform Admin", platformAdminEmail)` where `platformAdminEmail` is read from `PLATFORM_ADMIN_EMAIL` env var
  - Log the setup link: `https://platform.corp.com/setup` (or dev equivalent)
- [x] Add script to `src/shell/package.json`: `"bootstrap-platform": "tsx scripts/bootstrap-platform.ts"`
- [x] **Acceptance:** Running `pnpm bootstrap-platform` creates `tenant_platform` schema with seeded super_admin user; re-running is a no-op

#### M19-2: `isPlatformAdmin()` guard
- [x] Create `src/shell/lib/platform-guard.ts` with `isPlatformAdmin({ roles, tenantSlug })` function
- [x] In `src/shell/proxy.ts`: add `/platform` and `/api/platform` to `ADMIN_ROUTES` for middleware protection
- [x] **Acceptance:** Request with `tenantSlug="acme"` and `super_admin` role is blocked from `/platform/**`; request with `tenantSlug="platform"` and `super_admin` role passes

#### M19-3: Platform admin layout
- [x] Create `src/shell/app/(platform)/layout.tsx`:
  - Server component; calls `auth()` and `isPlatformAdmin()` → redirect `/403` if false
- [x] **Acceptance:** Authenticated platform admin sees the platform layout; non-platform-admin is redirected to 403

#### M19-4: Tenant provisioning API
- [x] Create `src/shell/app/api/platform/tenants/route.ts`: GET list + POST create
- [x] Create `src/shell/app/api/platform/tenants/[tenantId]/route.ts`: PATCH suspend/delete
- [x] **Acceptance:** POST creates tenant and schema; PATCH to `suspended` causes middleware to redirect that tenant's users to `/suspended`

#### M19-5: Platform tenants UI page
- [x] Create `src/shell/app/(platform)/platform/tenants/page.tsx`
- [x] **Acceptance:** Platform admin can create a tenant from the UI; created tenant appears in list; suspend changes status

#### M19-6: Org-level subscription admin view
- [x] Updated `src/shell/app/(shell)/admin/subscriptions/page.tsx` to show org-level subscription card (tier name, level, status, expiresAt, upgrade CTA)
- [x] Added `src/shell/app/api/admin/subscriptions/current/route.ts` for org subscription GET
- [x] **Acceptance:** Tenant admin sees org tier; no controls to self-upgrade; upgrade CTA shown for non-enterprise tiers

#### M19-7: Platform menu seeded from database
- [x] Added `seedPlatformMenu()` to `src/shell/lib/db/provision.ts`; called from `autoBootstrapPlatform()` after tenant and subscription defaults are seeded
- [x] Seeds one `menu_sections` row ("Platform") and 6 `menu_items` rows for the platform tenant on first bootstrap; idempotent on subsequent runs
- [x] Removed hardcoded platform submenu block from `src/shell/components/shell/sidebar.tsx`; removed `isPlatformAdmin` prop from `Sidebar`, `ShellLayoutClient`, and `(shell)/layout.tsx`
- [x] **Acceptance:** Platform menu appears via the standard data-driven sidebar render path; platform admins can manage it via the Menu Manager UI at `/platform/menu`

---

## M20 — Company Hierarchy

**Goal:** Each tenant can define an unlimited-depth company tree. Users are assigned to one or more nodes and inherit access to all descendants. A company switcher in the shell header lets users change their active company context.

**Depends on:** M19 complete.

**Status:** Complete

### Tasks

#### M20-1: Schema — companies, company_ancestors, user_companies
- [x] Add three tables to `src/shell/lib/db/tenant-schema.ts`
- [x] Add DDL to `perTenantDDL()` in `src/shell/lib/db/provision.ts`

#### M20-2: JWT — companyId and companyIds
- [x] Extend types in `src/shell/types/next-auth.d.ts`
- [x] Write company fields into JWT in `src/shell/lib/auth.ts`

#### M20-3: Server actions and API routes
- [x] `src/shell/lib/actions/companies.ts` — CRUD + closure table maintenance + access check
- [x] `/api/admin/companies` — GET/POST
- [x] `/api/admin/companies/[companyId]` — PATCH/DELETE
- [x] `/api/admin/users/[userId]/companies` — GET/PUT
- [x] `/api/users/me/company` — PUT (active company switch cookie)

#### M20-4: Admin UI
- [x] `/admin/companies` — company tree management
- [x] User manager — company assignment panel

#### M20-5: Company switcher
- [x] `CompanySwitcher` component in shell header

---

## v3 Backlog (Out of Scope for v2)

| Feature | Notes |
|---------|-------|
| Public self-serve tenant signup | Tenant provisioning currently platform-admin-only |
| Stripe / self-serve billing | HMAC webhook pattern retained as the integration point |
| Per-seat pricing model | Requires user count tracking + billing events |
| iFrame integration mode | CSP + postMessage auth for non-MF child apps |
| Audit log Admin Panel viewer | `authEvents` table already populated |
| Vercel support | MF/Webpack compatibility investigation needed |

---

*End of Roadmap v2.0*
