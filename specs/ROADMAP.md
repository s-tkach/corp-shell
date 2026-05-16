# Roadmap: Corporate Application Shell
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-05-16  
**PRD Reference:** `specs/PRD.md` v1.2  
**Architecture Reference:** `specs/ARCHITECTURE.md` v1.0

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
| M4 | Authentication & Session | Okta OIDC login/logout/JIT provisioning |
| M5 | RBAC & Middleware | Role-gated routes enforced end-to-end |
| M6 | Navigation Shell & Menu System | Data-driven sidebar, header, theme toggle |
| M7 | Admin Panel | All 7 admin sections fully functional |
| M8 | Module Federation Host | Child apps mountable via MF |
| M9 | Shell SDK & CLI | `@corp/shell-sdk` and `@corp/create-shell-app` published |
| M10 | Subscription & Entitlement Engine | Tier-gated nav, upgrade prompt, webhook |
| M11 | Observability & Security Hardening | Logging, tracing, CSP, audit events |
| M12 | Performance & Load Validation | NFR targets verified under load |

---

## M1 — Monorepo & Infrastructure Scaffold

**Goal:** A deployable, empty Next.js shell running on AWS. No features — just the skeleton that every subsequent task builds on.

### Tasks

#### M1-1: Initialize pnpm monorepo
- `pnpm init` at repo root; configure `pnpm-workspace.yaml` with `packages: [shell, packages/*, stacks]`
- Add root `package.json` with `engines.node`, `engines.pnpm`, and shared dev dependencies (`typescript`, `eslint`, `prettier`)
- Add `.nvmrc` / `.node-version` pinned to Node 20 LTS
- **Acceptance:** `pnpm install` completes; workspace packages resolve correctly

#### M1-2: Scaffold Next.js 15 shell app
- `pnpm create next-app shell --typescript --tailwind --app --no-src-dir`
- Install Shadcn/ui: `pnpm dlx shadcn@latest init` (select Tailwind v4, CSS variables)
- Copy sidebar, header, layout shell, and breadcrumb components from `satnaing/shadcn-admin` (Vite → Next.js App Router adaptation)
- Confirm dark/light mode toggle works with Shadcn's `ThemeProvider`
- **Acceptance:** `pnpm --filter shell dev` starts; sidebar and header render at `localhost:3000`

#### M1-3: Configure TypeScript & linting
- Strict `tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/ → shell/`)
- ESLint config: `next/core-web-vitals` + `@typescript-eslint/recommended`
- Prettier config with consistent formatting rules
- Add `pnpm typecheck` and `pnpm lint` scripts to root
- **Acceptance:** `pnpm typecheck` and `pnpm lint` both pass with zero errors on the scaffold

#### M1-4: Configure SST v3
- `pnpm add -D sst` at root; `npx sst init`
- Define `sst.config.ts`: VPC, Aurora Serverless v2 cluster, Secrets Manager secrets (placeholders), `sst.aws.Nextjs` pointing to `shell/`
- Configure `dev` / `staging` / `prod` stages with appropriate Aurora ACU settings
- **Acceptance:** `npx sst deploy --stage dev` completes; CloudFront URL returns Next.js 404 (no pages yet)

#### M1-5: Configure GitHub Actions — shell pipeline
- `.github/workflows/deploy-shell.yml`: trigger on push to `main` affecting `shell/**` or `sst.config.ts`
- Steps: `pnpm install` → `pnpm typecheck` → `pnpm lint` → `npx sst deploy --stage prod`
- Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` to repo secrets
- **Acceptance:** Push to `main` triggers pipeline; pipeline passes end-to-end

---

## M2 — Database Schema & Migrations

**Goal:** All database tables exist in the target environment; Drizzle ORM client is wired into the shell.

### Tasks

#### M2-1: Install and configure Drizzle ORM
- `pnpm --filter shell add drizzle-orm postgres`; `pnpm --filter shell add -D drizzle-kit`
- Create `shell/lib/db/client.ts`: instantiate Drizzle with `postgres` driver using `DATABASE_URL` from env
- Add `drizzle.config.ts` at root pointing to `shell/lib/db/schema.ts` and `shell/lib/db/migrations/`
- **Acceptance:** `pnpm drizzle-kit generate` runs without error; client imports without type errors

#### M2-2: Define schema
- Implement all tables in `shell/lib/db/schema.ts` as specified in `ARCHITECTURE.md §9.2`:
  `users`, `roles`, `user_roles`, `idp_group_role_mappings`, `subscription_tiers`, `user_subscriptions`, `menu_sections`, `menu_items`, `app_registry`, `shell_config`, `auth_events`
- **Acceptance:** `pnpm drizzle-kit generate` produces a single coherent migration; no type errors in schema file

#### M2-3: Apply initial migration
- Run `pnpm drizzle-kit migrate` against the dev Aurora instance
- Verify all tables and constraints exist via `psql` or Drizzle Studio
- Add migration step to the shell GitHub Actions pipeline (runs before `sst deploy`)
- **Acceptance:** All 11 tables present in dev DB; pipeline applies migrations automatically on deploy

---

## M3 — First-Run Setup Wizard

**Goal:** A fresh deployment redirects to `/setup`; completing the wizard writes config to DB, locks the route, and redirects to `/dashboard`.

### Tasks

#### M3-1: Setup detection middleware
- In `shell/middleware.ts`: query `shell_config.setup_complete`
  - If `false` (or no row): redirect all non-`/setup` traffic to `/setup`
  - If `true`: return 404 for `/setup`
- Cache the `setup_complete` flag in the JWT once setup is done (avoids DB hit on every request post-setup)
- **Acceptance:** Visiting any route on a fresh DB redirects to `/setup`; visiting `/setup` after completion returns 404

#### M3-2: Wizard UI scaffold (Step 1 — Branding)
- Multi-step form component at `app/setup/page.tsx` (Client Component, local React state only)
- Step 1: app name text input, logo image upload (preview), primary color picker (Shadcn color input)
- Logo upload: `POST /api/setup/upload-logo` → generates S3 presigned PUT URL → client uploads directly to S3
- **Acceptance:** Logo uploads to S3; preview renders in wizard; step 1 → step 2 navigation works

#### M3-3: Wizard Step 2 — Okta Connection
- Fields: Okta domain, Client ID, Client Secret
- On "Test Connection": `GET /api/setup/validate-okta?domain={domain}` → server pings `https://{domain}/.well-known/openid-configuration`
- Inline success ("Connected ✓") or error with exact failure message
- Wizard does not allow proceeding until connection is valid
- **Acceptance:** Valid domain shows success; invalid domain shows specific error; step cannot advance until valid

#### M3-4: Wizard Step 3 — Super Admin verification
- Input: Okta email address for the super admin
- "Verify via Okta Login" button: triggers NextAuth.js Okta sign-in inline (uses credentials entered in Step 2)
- On callback: verify that the authenticated email matches the input; show mismatch error if not
- **Acceptance:** Correct Okta user verified; mismatch shows error and allows retry; no session persisted until Step 4 launch

#### M3-5: Wizard Step 4 — Review & Launch
- Summary card displaying all inputs from Steps 1–3
- "Launch Shell" button: `POST /api/setup/complete` atomically writes:
  - `shell_config` row (branding, Okta domain, `setup_complete = true`)
  - Default `subscription_tiers` (free level 0, standard level 1, enterprise level 2)
  - Default `roles` (super_admin `isSystem=true`, admin)
  - `users` row for super admin (idpSource=okta, idpSubject from verified session)
  - `user_roles` (super_admin → super admin user)
  - `user_subscriptions` (enterprise tier, no expiry)
  - Stores Okta Client Secret to Secrets Manager (not in DB)
- Redirects to `/dashboard` on success
- **Acceptance:** All DB writes succeed atomically; `/setup` returns 404 after completion; `/dashboard` loads

---

## M4 — Authentication & Session

**Goal:** Okta OIDC login/logout works end-to-end; JIT provisioning creates user records on first login; session is embedded in an httpOnly JWT cookie.

### Tasks

#### M4-1: Install and configure NextAuth.js v5
- `pnpm --filter shell add next-auth@beta`
- Create `shell/lib/auth.ts`: configure Okta provider reading `OKTA_DOMAIN`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET` from Secrets Manager (resolved at Lambda start)
- Wire `GET/POST /api/auth/[...nextauth]` route handler
- Set `NEXTAUTH_SECRET` (Secrets Manager) for JWT encryption
- **Acceptance:** Visiting a protected route redirects to Okta; successful login returns to shell

#### M4-2: JWT callback — group mapping & subscription resolution
- In NextAuth.js `jwt()` callback:
  1. Extract `groups[]` from Okta ID token
  2. Query `idp_group_role_mappings` → resolve shell role slugs
  3. Query `user_subscriptions` → get tier and level
  4. Embed `{ userId, roles, subscriptionTier, subscriptionLevel }` in JWT payload
- **Acceptance:** `session.user.roles` and `session.user.subscriptionLevel` are populated after login

#### M4-3: JIT user provisioning
- In `jwt()` callback, if user email not found in `users` table:
  - `INSERT users` (email, displayName, idpSource='okta', idpSubject)
  - `INSERT user_roles` for each mapped role
  - `INSERT user_subscriptions` (free tier)
  - `INSERT auth_events` (LOGIN + JIT_PROVISION)
- Existing users: update `lastLoginAt`; write `auth_events` (LOGIN)
- **Acceptance:** First login creates user record; subsequent logins update `lastLoginAt`; no duplicate rows

#### M4-4: Logout — RP-Initiated Logout
- `signOut()` handler: clear local session cookie + redirect to Okta `/v1/logout?id_token_hint=...&post_logout_redirect_uri=...`
- Write `auth_events` (LOGOUT) before clearing session
- **Acceptance:** Logging out clears the cookie and ends the Okta session (verified by attempting to access a protected resource immediately after)

#### M4-5: Auth failure handling
- `/app/(auth)/error/page.tsx`: display human-readable message for NextAuth.js error codes (`OAuthCallbackError`, `AccessDenied`, etc.)
- Write `auth_events` (FAILURE) for any callback error
- **Acceptance:** Simulated Okta error shows friendly error page; failure event written to DB

---

## M5 — RBAC & Middleware

**Goal:** All protected routes are gated at the middleware layer; admin routes additionally require `super_admin` or `admin`; unauthorized access returns 403 without a redirect loop.

### Tasks

#### M5-1: Route protection middleware
- Extend `shell/middleware.ts` (post-setup path):
  - No session → redirect to `/api/auth/signin`
  - Session valid → continue
- Apply to all routes except `/api/auth/**`, `/(auth)/**`, `/_next/**`, `/favicon.ico`
- **Acceptance:** Unauthenticated request to `/dashboard` redirects to Okta; authenticated request passes through

#### M5-2: Admin route guard
- Middleware: for routes matching `/admin/**` and `/api/admin/**`, assert `session.roles` includes `super_admin` or `admin`
- Unauthorized → render `app/(shell)/403/page.tsx` with "Access Denied" message (no redirect loop)
- **Acceptance:** User without admin role visiting `/admin/menu` sees 403 page; admin role user passes through

#### M5-3: API route role enforcement
- Create `shell/lib/auth-guard.ts`: `requireRoles(roles: string[])` helper — reads session, throws 403 response if roles not satisfied
- Apply to all `admin/**` API handlers and any other role-restricted endpoints
- **Acceptance:** `curl` to `/api/admin/users` without admin session returns HTTP 403 JSON

#### M5-4: 403 page
- `app/(shell)/403/page.tsx`: "Access Denied" UI with link back to `/dashboard`
- **Acceptance:** Renders correctly for both middleware-blocked and API-blocked scenarios

---

## M6 — Navigation Shell & Menu System

**Goal:** The sidebar renders from the database, filters items by the session's roles and subscription level, and persists collapse state and theme per user.

### Tasks

#### M6-1: Menu API
- `GET /api/menu`: reads `menu_sections` + `menu_items` from DB, filters by `session.roles` and `session.subscriptionLevel`, returns ordered tree
- Response cached with a short TTL (revalidated on menu config change via Admin Panel)
- **Acceptance:** API returns correct items for a given role/tier combination; items the user lacks access to are absent

#### M6-2: Server-side menu render in RootLayout
- `shell/app/layout.tsx` (Server Component): call `auth()` → call `/api/menu` (server-side fetch) → pass menu tree to `<Sidebar>`
- `<Sidebar>` renders sections and items; highlights active route
- **Acceptance:** Sidebar shows role-filtered menu on every page load without client-side flash

#### M6-3: Sidebar collapse state persistence
- Zustand store for collapse state (client-side optimistic)
- On toggle: `PATCH /api/users/me/preferences` writes `sidebarCollapsed` to a `user_preferences` JSON column on `users`
- On load: initial state read from session (embedded at login) or API
- **Acceptance:** Collapse state survives page refresh and new browser sessions for the same user

#### M6-4: Top header bar
- App logo + name from `shell_config` (server-fetched in RootLayout)
- Breadcrumb trail derived from current route and menu tree
- User avatar dropdown: display name, role badges, logout button
- Notification slot (empty div with `data-shell-notifications` — child apps can mount here via SDK)
- **Acceptance:** Logo, name, breadcrumbs, and user dropdown all render correctly; logout triggers M4-4 flow

#### M6-5: Light/dark mode toggle
- Shadcn `ThemeProvider` already installed (M1-2); wire toggle button in header
- Persist preference: `PATCH /api/users/me/preferences` with `theme: 'light' | 'dark'`
- On load: server embeds theme preference in root HTML `class` to avoid flash
- **Acceptance:** Toggle changes theme instantly; preference persists across sessions

---

## M7 — Admin Panel

**Goal:** All 7 admin sections are functional. Admins can manage all shell configuration without touching code or redeploying.

### Tasks

#### M7-1: Admin layout & navigation
- `app/(shell)/admin/layout.tsx`: guard renders 403 if role check fails (redundant with middleware — defense in depth)
- "Admin" section in sidebar visible only to `super_admin` and `admin` roles
- **Acceptance:** Admin sidebar section hidden for non-admin users; visible for admin users

#### M7-2: Menu Manager
- Full CRUD for `menu_sections` and `menu_items`
- Drag-and-drop reorder (updates `sortOrder` in DB)
- Inline role multi-select and subscription level picker per item
- Live role-filtered preview panel (renders sidebar as a given role would see it)
- **Acceptance:** Create/edit/delete/reorder items; changes reflected in sidebar within one page load

#### M7-3: Role Manager
- CRUD for roles (cannot delete or rename `super_admin`)
- IDP Mapping editor: add/remove Okta group → shell role mappings in `idp_group_role_mappings`
- "Users with this role" count displayed per role
- **Acceptance:** New role created; Okta group mapped; mapping visible in `idp_group_role_mappings`

#### M7-4: User Manager
- Paginated table of all `users` (email, displayName, roles, subscriptionTier, lastLoginAt, isActive)
- Assign/revoke roles per user (writes `user_roles`)
- Set subscription tier + expiry (writes `user_subscriptions`)
- Deactivate user (sets `isActive = false`; deactivated users are blocked at middleware)
- **Acceptance:** Role assignment takes effect on user's next login; deactivated user cannot log in

#### M7-5: SSO Status
- Read-only display of `shell_config.oktaDomain` and `OKTA_CLIENT_ID` (non-secret)
- Live reachability check: server pings `https://{domain}/.well-known/openid-configuration` on page load
- Displays "Connected ✓" or error detail
- **Acceptance:** Connected state shows correctly; simulated bad domain shows error detail

#### M7-6: Application Registry
- Register child app: `name`, `remoteUrl`, `routePrefix`, `healthCheckUrl`
- "Validate & Fetch Manifest": server fetches `{remoteUrl}/mf-manifest.json`, validates shape, previews routes
- Route-to-menu-item mapping UI
- Live health status: periodic ping of `healthCheckUrl`; `lastHealthyAt` updated in DB
- Enable/disable app toggle
- **Acceptance:** Registered app manifest validates; app appears in MF remote list within 60 seconds

#### M7-7: Subscription Tiers
- CRUD for `subscription_tiers` (cannot delete `free` — it is the default)
- Set numeric level per tier
- Configure Upgrade Prompt content (headline, body, CTA label, CTA URL) per tier
- **Acceptance:** New tier created with level; upgrade prompt content saves and renders on restricted route

#### M7-8: Theme & Branding
- Edit app name, re-upload logo (new S3 presigned PUT), change primary brand color
- Live preview panel reflecting changes before save
- `PATCH /api/admin/branding` writes to `shell_config`; changes apply globally without redeploy
- **Acceptance:** Name and logo update reflected in header within one page reload

---

## M8 — Module Federation Host

**Goal:** Child apps registered in the Application Registry can be loaded into the shell's `[...slug]` catch-all route via Module Federation.

### Tasks

#### M8-1: Install and configure `@module-federation/nextjs-mf`
- `pnpm --filter shell add @module-federation/nextjs-mf`
- `shell/next.config.ts`: add `NextFederationPlugin` with `name: 'shell'` and shared singletons (`react`, `react-dom`, `@corp/shell-sdk`)
- Remotes loaded from DB via `shell/lib/mf/router.ts`; cached 60 seconds
- **Acceptance:** `pnpm --filter shell build` succeeds with MF plugin; no shared module conflicts

#### M8-2: Remote resolution and route registry
- `shell/lib/mf/router.ts`: `fetchRegisteredApps()` queries `app_registry`, maps `routePrefix → remoteEntry URL`
- `useShellRouting()` hook: given current `pathname`, finds longest matching `routePrefix` → returns lazy-loaded `AppEntry`
- **Acceptance:** Hook resolves correct remote for a given pathname; unmatched routes return null

#### M8-3: Child app mount page
- `app/(shell)/[...slug]/page.tsx` (Client Component):
  ```tsx
  const AppEntry = useShellRouting();
  return (
    <ErrorBoundary fallback={<AppErrorView />}>
      <Suspense fallback={<AppSkeleton />}>
        <AppEntry />
      </Suspense>
    </ErrorBoundary>
  );
  ```
- `AppSkeleton`: loading placeholder matching shell layout dimensions
- `AppErrorView`: error UI scoped to content area; sidebar and header unaffected
- **Acceptance:** Navigating to a registered route loads `AppEntry`; crash in child app shows `AppErrorView` only

#### M8-4: ShellSDKProvider wrapper
- Wrap `AppEntry` in `<ShellSDKProvider>` passing `user`, `navigate`, `theme` values from session and Zustand
- **Acceptance:** `useShellUser()` inside a child app returns correct user data; `useShellTheme()` returns current theme

#### M8-5: End-to-end MF smoke test
- Create a minimal test child app in `packages/test-child-app/` (not published): exposes `AppEntry` that renders user email from `useShellUser()`
- Register it in dev Admin Panel; verify it loads in the `[...slug]` route
- **Acceptance:** Test child app renders user email via SDK hook; ErrorBoundary catches a manually thrown error

---

## M9 — Shell SDK & CLI

**Goal:** `@corp/shell-sdk` is published to GitHub Packages and usable by child app teams. `@corp/create-shell-app` CLI scaffolds a ready-to-deploy child app project.

### Tasks

#### M9-1: Shell SDK — hooks and event bus
- `packages/shell-sdk/src/hooks/useShellUser.ts`
- `packages/shell-sdk/src/hooks/useShellNavigate.ts`
- `packages/shell-sdk/src/hooks/useShellTheme.ts`
- `packages/shell-sdk/src/events/ShellEventBus.ts`: `emit`, `on`, `off` typed event system
- `packages/shell-sdk/src/tailwind/preset.ts`: exports shared color/spacing tokens
- TypeScript build (`tsc --declaration`); `package.json` with `exports` map
- **Acceptance:** All hooks and event bus export with correct TypeScript types; `pnpm --filter shell-sdk build` passes

#### M9-2: Shell SDK — publish pipeline
- `.github/workflows/publish-sdk.yml`: trigger on tag `shell-sdk/v*.*.*`
- Steps: build → `npm publish --access restricted` with `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
- Package name: `@corp/shell-sdk` on GitHub Packages
- **Acceptance:** Tagged release publishes package; `npm install @corp/shell-sdk` resolves from GitHub Packages

#### M9-3: Create-shell-app CLI — scaffolder
- `packages/create-shell-app/src/index.ts`: reads `<app-name>` arg, copies `template/` with substitutions
- Template contents:
  - React 18 + TypeScript + Webpack 5
  - Module Federation remote config (pre-filled `name`, `filename: 'remoteEntry.js'`)
  - `AppEntry.tsx` stub
  - `mf-manifest.json` template
  - `@corp/shell-sdk` pre-installed in template `package.json`
  - `.github/workflows/deploy.yml`: build → S3 sync → CloudFront invalidation
  - `README.md` with registration walkthrough
- **Acceptance:** `npx @corp/create-shell-app my-app` creates a valid project; `cd my-app && pnpm install && pnpm build` succeeds

#### M9-4: Create-shell-app — publish pipeline
- `.github/workflows/publish-cli.yml`: trigger on tag `create-shell-app/v*.*.*`
- Published as `@corp/create-shell-app` on GitHub Packages
- **Acceptance:** `npx @corp/create-shell-app` resolves from GitHub Packages after publish

---

## M10 — Subscription & Entitlement Engine

**Goal:** Subscription tier gates work end-to-end: restricted routes show Upgrade Prompt, admin can change tiers, and the webhook endpoint applies tier changes immediately.

### Tasks

#### M10-1: Subscription gate in middleware and Server Component
- Middleware: for routes with `requiredSubLevel > 0`, check `session.subscriptionLevel`; if insufficient, redirect to `/upgrade?from={route}`
- `app/(shell)/upgrade/page.tsx`: renders Upgrade Prompt content from `subscription_tiers.upgradeCta` / `upgradeUrl` for the required tier
- **Acceptance:** User with `free` tier accessing a `standard` route sees Upgrade Prompt; `standard` user passes through

#### M10-2: Subscription expiry enforcement
- In NextAuth.js `jwt()` callback: if `user_subscriptions.expiresAt` is in the past, downgrade to `free` tier and update DB
- **Acceptance:** User with expired subscription gets `free` tier on next login; DB updated

#### M10-3: Webhook endpoint
- `POST /api/internal/subscriptions/assign`:
  - Validate `X-Webhook-Signature` header (HMAC-SHA256 with `WEBHOOK_SECRET` from Secrets Manager, constant-time compare)
  - Payload: `{ userId, tierId, expiresAt? }`
  - Write to `user_subscriptions`
  - Return 200; invalid signature returns 401
- **Acceptance:** Valid signed request updates user tier; unsigned/wrong-signature request returns 401; no timing attack surface

---

## M11 — Observability & Security Hardening

**Goal:** Structured logs flow to CloudWatch; request traces are correlated; CSP headers are set; all NFR security requirements are verified.

### Tasks

#### M11-1: Structured logging
- `shell/lib/logger.ts`: thin wrapper that outputs `JSON.stringify({ level, message, traceId, ...meta })` to stdout (CloudWatch captures Lambda stdout automatically)
- Attach trace ID (from `instrumentation.ts`) to every log line
- Replace any `console.log` calls in API handlers with the logger
- **Acceptance:** CloudWatch Log Insights query on `traceId` returns all log lines for a single request

#### M11-2: Request tracing
- `shell/instrumentation.ts`: configure OpenTelemetry with `@vercel/otel` or AWS X-Ray SDK
- Propagate trace context through API route handlers
- **Acceptance:** X-Ray service map shows shell Lambda and Aurora as connected nodes

#### M11-3: CSP and security headers
- Next.js `headers()` in `next.config.ts`:
  - `Content-Security-Policy`: restrict script/style/connect sources; allow child app CloudFront origins explicitly
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=()`
- **Acceptance:** Security headers present on all responses; CSP does not block shell or registered child app assets

#### M11-4: Security checklist verification
- Walk through `ARCHITECTURE.md §12` security table; verify each row is implemented
- Confirm: no secrets in source, HMAC webhook validation, no `localStorage` token storage, admin routes server-checked, `super_admin` lockout prevention active
- **Acceptance:** All items in the security table have a corresponding passing implementation or test

---

## M12 — Performance & Load Validation

**Goal:** All NFR performance and availability targets are verified before v1 launch.

### Tasks

#### M12-1: Shell load time baseline (P95 < 2s)
- Enable CloudWatch RUM on the shell CloudFront distribution
- Measure P95 LCP from 50 simulated users on 10 Mbps throttled connection
- Identify and fix any asset bundle size issues (code splitting, dynamic imports)
- **Acceptance:** P95 shell initial load < 2 seconds confirmed in CloudWatch RUM

#### M12-2: Child app MF cold load baseline (P95 < 1.5s)
- Measure time from navigation to `AppEntry` render-complete for a registered test child app
- Optimize `remoteEntry.js` bundle size if needed
- **Acceptance:** P95 MF cold load < 1.5 seconds confirmed

#### M12-3: Load test at 1,000 concurrent sessions
- Run k6 or Artillery load test: 1,000 virtual users, authenticated sessions, mixed navigation and API calls
- Monitor Aurora ACU scaling, Lambda concurrency, and CloudFront cache hit rate
- **Acceptance:** Zero 5xx errors; P99 API response < 500ms; Aurora stays within 2 ACU; Lambda concurrency headroom > 20%

#### M12-4: Availability smoke test
- Route 53 health check configured for `app.corp.com`
- Simulate Lambda cold start surge; verify < 1% cold start impact on P95
- **Acceptance:** Health check passes; 99.9% availability target met over 72-hour observation window

---

## Launch Checklist

Before marking v1 as released, confirm:

- [ ] All M1–M12 acceptance criteria passed
- [ ] `/setup` returns 404 in production
- [ ] `super_admin` account verified and secured
- [ ] All secrets in Secrets Manager; zero secrets in git or Lambda env vars (only ARN references)
- [ ] CloudWatch alarms configured for error rate, Aurora ACU, and Lambda throttling
- [ ] `@corp/shell-sdk` v1.0.0 published to GitHub Packages
- [ ] At least one child app successfully onboarded end-to-end (< 2 hours)
- [ ] Cost Explorer tag `project=corp-shell` shows < $100/month in production

---

## v2 Backlog (Out of Scope for v1)

| Feature | Depends On |
|---------|-----------|
| iFrame integration mode (CSP + postMessage auth) | M8 complete |
| Audit log Admin Panel viewer | M11 auth_events table |
| Subdomain multi-tenant routing | New SST stack per tenant |
| Self-serve billing (Stripe/Chargebee) | M10 webhook endpoint |
| Dynamic IDP registration via Admin Panel | M4 auth config |
| Organization-level subscription management | M10 complete |

---

*End of Roadmap v1.0*
