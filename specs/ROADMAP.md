# Roadmap: Corporate Application Shell
**Version:** 1.1  
**Status:** Updated  
**Date:** 2026-05-23  
**PRD Reference:** `specs/PRD.md` v1.3  
**Architecture Reference:** `specs/ARCHITECTURE.md` v1.1

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
| M3 | First-Run Setup Wizard | Shell becomes operational via wizard |
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

## M3 — First-Run Setup Wizard

**Goal:** A fresh deployment redirects to `/setup`; completing the wizard writes config to DB, locks the route, and redirects to `/dashboard`.

### Tasks

#### M3-1: Setup detection middleware
- [x] In `shell/middleware.ts`: query `shell_config.setup_complete`
  - If `false` (or no row): redirect all non-`/setup` traffic to `/setup`
  - If `true`: return 404 for `/setup`
- [x] Cache the `setup_complete` flag in the JWT once setup is done (avoids DB hit on every request post-setup)
- [x] **Acceptance:** Visiting any route on a fresh DB redirects to `/setup`; visiting `/setup` after completion returns 404

#### M3-2: Wizard UI scaffold (Step 1 — Branding)
- [x] Multi-step form component at `app/setup/page.tsx` (Client Component, local React state only)
- [x] Step 1: app name text input, logo image upload (preview), primary color picker (Shadcn color input)
- [x] Logo upload: `POST /api/setup/upload-logo` → generates S3 presigned PUT URL → client uploads directly to S3
- [x] **Acceptance:** Logo uploads to S3; preview renders in wizard; step 1 → step 2 navigation works

#### M3-3: Wizard Step 2 — OIDC Connection
- [x] Fields: Issuer URL, Client ID, Client Secret
- [x] On "Test Connection": `GET /api/setup/validate-oidc?issuer={issuer}` → server pings `{issuer}/.well-known/openid-configuration`
- [x] Inline success ("Connected ✓") or error with exact failure message
- [x] Wizard does not allow proceeding until connection is valid
- [x] **Acceptance:** Valid domain shows success; invalid domain shows specific error; step cannot advance until valid

#### M3-4: Wizard Step 3 — Super Admin verification
- [x] Input: email address for the super admin
- [x] "Verify via OIDC Login" button: triggers NextAuth.js OIDC sign-in inline (uses credentials entered in Step 2)
- [x] On callback: verify that the authenticated email matches the input; show mismatch error if not
- [x] **Acceptance:** Correct user verified; mismatch shows error and allows retry; no session persisted until Step 4 launch

#### M3-5: Wizard Step 4 — Review & Launch
- [x] Summary card displaying all inputs from Steps 1–3
- [x] "Launch Shell" button: `POST /api/setup/complete` atomically writes:
  - `shell_config` row (branding, OIDC issuer, `setup_complete = true`)
  - Default `subscription_tiers` (free level 0, standard level 1, enterprise level 2)
  - Default `roles` (super_admin `isSystem=true`, admin)
  - `users` row for super admin (idpSource=oidc, idpSubject from verified session)
  - `user_roles` (super_admin → super admin user)
  - `user_subscriptions` (enterprise tier, no expiry)
  - Stores OIDC Client Secret to Secrets Manager (not in DB)
- [x] Redirects to `/dashboard` on success
- [x] **Acceptance:** All DB writes succeed atomically; `/setup` returns 404 after completion; `/dashboard` loads

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

#### M9-3: Create-shell-app CLI — scaffolder
- [x] `packages/create-shell-app/src/index.ts`: reads `<app-name>` arg, copies `template/` with substitutions
- [x] Template contents:
  - React 18 + TypeScript + Webpack 5
  - Module Federation remote config (pre-filled `name`, `filename: 'remoteEntry.js'`)
  - `AppEntry.tsx` stub
  - `mf-manifest.json` template
  - `@corp/shell-sdk` pre-installed in template `package.json`
  - `.github/workflows/deploy.yml`: build → S3 sync → CloudFront invalidation
  - `README.md` with registration walkthrough
- [x] **Acceptance:** `npx @corp/create-shell-app my-app` creates a valid project; `cd my-app && pnpm install && pnpm build` succeeds

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
- [ ] Add `notifications` table to `shell/lib/db/schema.ts`: `id`, `title`, `body`, `actionLabel`, `actionType`, `actionPayload`, `targetType`, `targetUserId` (FK → users), `targetSubLevel`, `expiresAt`, `createdBy` (FK → users), `createdAt`
- [ ] Add `notificationReads` table: `notificationId` (FK → notifications, cascade delete), `userId` (FK → users, cascade delete), `readAt`; PK `(notificationId, userId)`
- [ ] Update existing migration file in place (no new migration file)
- [ ] **Acceptance:** Migration runs; both tables exist in DB with correct constraints

#### M13-2: User-facing API routes
- [ ] `GET /api/notifications`: returns paginated visible, non-expired notifications for current user with `isRead` per row; applies visibility logic (targetType + expiry)
- [ ] `POST /api/notifications`: creates notification from request body; `createdBy` set from session; triggers SSE push to eligible connected users; returns `{ id }`; usable by any authenticated user including child apps
- [ ] `POST /api/notifications/read`: body `{ notificationId: string | "all" }` — upserts rows in `notification_reads`; returns updated unread count
- [ ] `GET /api/notifications/stream`: SSE endpoint; registers controller in module-level registry; sends `notification` events; sends `": ping"` comment every 30s; cleans up on disconnect
- [ ] **Acceptance:** List returns correct items for user; create returns 201 with id; read marks correctly; SSE connection stays open and receives test event

#### M13-3: Admin API routes
- [ ] `GET /api/admin/notifications`: paginated list of all notifications with read count per notification; requires `admin` or `super_admin` via `requireRoles()`
- [ ] `POST /api/admin/notifications`: creates notification from request body; triggers SSE push to eligible connected users; returns created record
- [ ] `DELETE /api/admin/notifications/[id]`: hard deletes notification (cascade removes read records); requires admin role
- [ ] **Acceptance:** Create returns 201 with id; delete returns 204; unauthorized request returns 403

#### M13-4: Zustand store additions
- [ ] Add `unreadCount: number`, `setUnreadCount(n: number)`, `incrementUnreadCount()` to `shell/lib/store/shell-store.ts`
- [ ] **Acceptance:** `useShellStore()` exposes new fields without TypeScript errors

#### M13-5: NotificationProvider
- [ ] `shell/components/shell/notifications/notification-provider.tsx`: Client component; opens `EventSource` to `/api/notifications/stream` on mount; reconnects with exponential backoff (1s → 2s → 4s … max 30s); on `notification` event: appends toast to local state, calls `incrementUnreadCount()`
- [ ] Exposes `useNotifications()` hook: `{ notifications, unreadCount, markRead, markAllRead, refresh }`
- [ ] Wrap `ShellLayoutClient` (or equivalent) with `NotificationProvider` in `shell/app/(shell)/layout.tsx`
- [ ] Initial unread count loaded from `GET /api/notifications` on mount; stored in Zustand
- [ ] **Acceptance:** Provider mounts without errors; SSE reconnects after simulated disconnect

#### M13-6: NotificationBell + NotificationDropdown
- [ ] `shell/components/shell/notifications/notification-bell.tsx`: Ghost `Button` (size `icon`) with `Bell` from lucide-react; absolute-positioned red badge showing `unreadCount` (hidden when 0, `99+` when > 99); wraps `NotificationDropdown` in `DropdownMenu`
- [ ] Replace `<div data-shell-notifications />` in `shell/components/shell/header.tsx` with `<NotificationBell />`
- [ ] `shell/components/shell/notifications/notification-dropdown.tsx`: 320px wide, max-height 480px; header row with "Notifications" + "Mark all read"; All/Unread tabs (client-side filter); per-row: dot indicator, bold/muted title, 2-line body, relative timestamp, action link; empty state; loading skeleton
- [ ] **Acceptance:** Bell appears in header; badge shows/hides correctly; dropdown opens with correct items; clicking row marks read

#### M13-7: NotificationToast
- [ ] `shell/components/shell/notifications/notification-toast.tsx`: fixed bottom-right; toasts stack upward; max 3 simultaneous (oldest dismissed on 4th); each toast: bell icon, title, body (truncated), optional action link, × button; auto-dismiss after 5s
- [ ] No external toast library — local React state in `NotificationProvider`
- [ ] **Acceptance:** Toast appears on SSE event; auto-dismisses at 5s; × dismisses immediately; 4th toast displaces oldest

#### M13-8: Admin notifications page
- [ ] `shell/app/(shell)/admin/notifications/page.tsx`: table of all notifications (title, target, expires, created, delete action); "Create notification" button opens dialog/sheet with fields: title, body, target type (All/User/Subscription select), conditional target user search or min sub level, optional action group (label + type + payload), optional expires at datetime
- [ ] Add `"/admin/notifications": "Notifications"` to `ADMIN_ROUTE_LABEL_MAP`
- [ ] Server-side role guard via `requireRoles(["admin", "super_admin"])` in the page
- [ ] **Acceptance:** Admin can create notification; notification appears in table; delete removes it; non-admin role cannot access page

---

## M14 — Open-Source Readiness

**Goal:** The shell runs without any AWS account via Docker Compose + local env vars. KMS and S3 each have local fallbacks. Repo has OSS contribution infrastructure. Core security-critical paths have Vitest test coverage.

**Depends on:** M1–M13 complete.

---

### Tasks

#### M14-1: CryptoProvider abstraction (Gap 1)

- [ ] Create `shell/lib/crypto.ts`: export `CryptoProvider` interface `{ encrypt(plaintext: string): Promise<string>; decrypt(ciphertext: string): Promise<string> }`; `KmsCryptoProvider` (delegates to existing `lib/kms.ts`; activated when `ENCRYPTION_PROVIDER=kms` or `KMS_KEY_ID` is set); `LocalCryptoProvider` (AES-256-GCM via `node:crypto`, reads `ENCRYPTION_KEY` (64 hex chars), per-value random IV, output format `local:<iv_hex>:<ct_hex>:<tag_hex>`); `getProvider()` factory selecting on env at module load; top-level `encrypt()` and `decrypt()` exports
- [ ] Update `shell/lib/kms.ts`: re-export `encrypt`/`decrypt` from `crypto.ts` for backwards compatibility
- [ ] Update `shell/app/api/setup/complete/route.ts`: call `encrypt()` from `lib/crypto.ts` instead of `kmsEncrypt()` directly
- [ ] Update `shell/lib/auth.ts:getOidcConfig()`: call `decrypt()` from `lib/crypto.ts` instead of `kmsDecrypt()` directly
- [ ] Update `shell/.env.local.example`: document `ENCRYPTION_KEY` and `ENCRYPTION_PROVIDER` entries with instructions
- [ ] **Acceptance:**
  - `ENCRYPTION_PROVIDER=local ENCRYPTION_KEY=<64-hex-chars>`: wizard completes; OIDC secret stored as `local:...` ciphertext; auth flow decrypts correctly
  - `ENCRYPTION_PROVIDER=kms KMS_KEY_ID=<arn> AWS_REGION=<region>`: existing KMS behavior unchanged
  - Starting the app with neither `KMS_KEY_ID` nor `ENCRYPTION_KEY` set logs a clear startup error and refuses to start

#### M14-2: StorageProvider abstraction (Gap 2)

- [ ] Create `shell/lib/storage.ts`: export `StorageProvider` interface `{ upload(filename: string, contentType: string, data?: Buffer): Promise<{ uploadUrl?: string; publicUrl: string }> }`; `S3StorageProvider` (existing presigned PUT logic; activated when `STORAGE_PROVIDER=s3` or `AWS_S3_BUCKET` set); `LocalStorageProvider` (writes file to `public/uploads/logos/<filename>`, returns `{ publicUrl: '/uploads/logos/<filename>' }`); `getProvider()` factory
- [ ] Update `shell/app/api/setup/upload-logo/route.ts`: delegate to `storage.ts` provider
- [ ] Update `shell/app/(shell)/admin/branding` upload API handler: consolidate existing duplicated S3 presign logic into `storage.ts`
- [ ] Update `shell/app/setup/page.tsx`: if `uploadUrl` absent in response, POST file directly (multipart); if present, PUT to presigned URL
- [ ] Add `public/uploads/.gitkeep`; add `public/uploads/logos/` to `.gitignore`
- [ ] **Acceptance:**
  - `STORAGE_PROVIDER=local` (no `AWS_S3_BUCKET`): wizard step 1 uploads logo; logo appears at `/uploads/logos/<filename>`; `shell_config.logoUrl` contains the relative path
  - `STORAGE_PROVIDER=s3` (with `AWS_S3_BUCKET` set): existing presigned-PUT S3 behavior unchanged
  - Branding re-upload in Admin Panel → Theme uses the same storage abstraction

#### M14-3: Docker Compose + env documentation (Gaps 3, 4, 5)

- [ ] Add `docker-compose.yml` at repo root: `postgres:15-alpine`, `POSTGRES_DB/USER/PASSWORD=corpshell`, port 5432, named volume `postgres_data`
- [ ] Update `shell/.env.local.example`: add `DATABASE_URL=postgresql://corpshell:corpshell@localhost:5432/corpshell` as the default local value; add comment clarifying `DATABASE_URL` and `NEXTAUTH_SECRET` are plain env vars (Secrets Manager is only for Amplify production); move RUM env vars (`NEXT_PUBLIC_RUM_APP_MONITOR_ID`, `NEXT_PUBLIC_RUM_GUEST_ROLE_ARN`, `NEXT_PUBLIC_RUM_IDENTITY_POOL_ID`) to a clearly marked `# Optional: AWS CloudWatch RUM (omit for local dev)` section
- [ ] Remove unused `@aws-sdk/client-secrets-manager` from `shell/package.json` (never imported in code)
- [ ] Update `shell/lib/logger.ts` to read a generic `TRACE_ID` env var before falling back to `_X_AMZN_TRACE_ID`
- [ ] **Acceptance:**
  - `docker compose up -d` starts Postgres at localhost:5432 with the `.env.local.example` connection string
  - App starts with only `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` set; no AWS credentials or Secrets Manager access needed

#### M14-4: Conditional CSP for S3 origins (Gap 6)

- [ ] Update `shell/next.config.ts`: make `img-src`, `connect-src`, and `script-src` S3/CloudFront entries conditional on `process.env.AWS_S3_BUCKET` being set (same pattern as existing RUM script origin conditional)
- [ ] **Acceptance:**
  - `AWS_S3_BUCKET` unset: S3 CloudFront origin absent from CSP; no console CSP violations in local dev
  - `AWS_S3_BUCKET` set: S3 CloudFront origin present in CSP; existing production behavior unchanged

#### M14-5: OSS DX files (Gap 7)

- [ ] Create `CONTRIBUTING.md`: local dev setup (Docker Compose → `.env.local` → `pnpm dev`), branching model (feature branches → PR to `main`), PR checklist, coding conventions (TypeScript strict, ESLint, Prettier), how to run tests (`pnpm test`)
- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.md`: fields for environment, steps to reproduce, expected vs. actual behavior, logs
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.md`: fields for problem statement, proposed solution, alternatives considered
- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md`: sections for summary, test plan, breaking changes, checklist (tests pass, types pass, lint passes)
- [ ] Create `CHANGELOG.md`: semantic versioning format; initial entry for v1.0.0 listing M1–M13 features
- [ ] Rewrite `README.md` "Getting started" section: local-first path as primary; AWS/Amplify as secondary; link to `CONTRIBUTING.md` for contributor setup
- [ ] **Acceptance:**
  - New contributor can reach the setup wizard following only the README "Getting started" section; no steps require AWS credentials
  - `CONTRIBUTING.md` covers all steps needed to run tests locally

#### M14-6: Vitest test suite (Gap 8)

- [ ] Add `shell/vitest.config.ts`: configure Vitest for the `shell/` workspace; path aliases matching `tsconfig.json`; environment `node`
- [ ] Add `pnpm --filter shell test` script to `shell/package.json`; add root `pnpm test` script that delegates to shell
- [ ] Create `shell/tests/crypto.test.ts`:
  - Local provider: `encrypt` then `decrypt` round-trip returns original plaintext
  - Local provider: two calls produce different ciphertexts (IV randomness)
  - Local provider: output starts with `local:`
  - Local provider: tampered ciphertext throws on decrypt (GCM auth tag verification)
  - Provider selection: `ENCRYPTION_PROVIDER=local` selects local; `ENCRYPTION_PROVIDER=kms` selects KMS (mock KMS client)
- [ ] Create `shell/tests/auth.test.ts` (mock Drizzle client):
  - JIT provisioning: new user email inserts user row, role rows, subscription row
  - Existing user: `lastLoginAt` updated; no duplicate rows
  - Subscription expiry: expired subscription downgrades to `free` tier in the JWT
  - Group mapping: IDP group mapped to shell role appears in JWT `roles[]`
- [ ] Create `shell/tests/middleware.test.ts`:
  - Setup not complete: any non-`/setup` path redirects to `/setup`
  - Setup complete: `/setup` returns 404
  - No session: protected route redirects to `/api/auth/signin`
  - Session with `admin` role: `/admin/menu` passes through
  - Session without `admin` role: `/admin/menu` returns 403
- [ ] Create `shell/tests/setup-complete.test.ts` (mock Drizzle client):
  - Idempotency: second POST to `/api/setup/complete` after `setup_complete = true` returns 400
  - Atomic write: if any INSERT fails, transaction rolls back (no partial state)
  - Encrypts OIDC client secret before writing (verifies ciphertext != plaintext in DB)
- [ ] **Acceptance:** `pnpm --filter shell test` passes all tests with zero failures

---

### M14 Launch Criteria

Before marking M14 complete:

- [ ] `git clone` on a machine with zero AWS credentials → `docker compose up -d` → fill `.env.local` → `pnpm dev` → `/setup` wizard reachable with no errors
- [ ] Wizard completes end-to-end in local mode (local crypto + local storage)
- [ ] `pnpm --filter shell test` passes with zero failures
- [ ] Switching to AWS mode (`ENCRYPTION_PROVIDER=kms`, `STORAGE_PROVIDER=s3`, real credentials) works without code changes
- [ ] All Gap 7 files present and reviewed

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

## v2 Backlog (Out of Scope for v1)

| Feature | Depends On |
|---------|-----------|
| iFrame integration mode (CSP + postMessage auth) | M8 complete |
| Audit log Admin Panel viewer | M11 auth_events table |
| Subdomain multi-tenant routing | New Amplify app per tenant (or CloudFront routing rules) |
| Self-serve billing (Stripe/Chargebee) | M10 webhook endpoint |
| Dynamic IDP registration via Admin Panel | M4 auth config |
| Organization-level subscription management | M10 complete |
| Vercel support | Depends on MF/Webpack compatibility investigation; see ARCHITECTURE.md v2 notes |

---

*End of Roadmap v1.1*
