# PRD: Corporate Application Shell
**Version:** 1.2 — Final Draft  
**Status:** Ready for Engineering  
**Date:** 2026-05-16

---

## Changelog

| Version | Change |
|---------|--------|
| 1.0 | Initial draft |
| 1.1 | Next.js confirmed; iFrame/audit logs/subdomains → v2; OIDC-only auth; Aurora replaces DynamoDB; SST v3 deployment |
| 1.2 | All open questions resolved: Okta as first IDP (config documented); single AWS account (infra simplified); GitHub Packages for SDK registry; first-run setup wizard added for branding/naming |

---

## 1. Executive Summary

This document describes a **Corporate Application Shell** — a host web application built with **Next.js 15 (App Router)** and **Shadcn/ui** that serves as the single entry point for all internal corporate tools. It provides SSO via **Okta (OIDC)** with support for any future OIDC-compliant IDP, role-gated and subscription-gated navigation, micro-frontend hosting for independently deployed child React applications, and a self-contained admin panel for all configuration.

All child apps share the same AWS account as the shell. The SDK and CLI scaffolder are published to **GitHub Packages**. A **first-run setup wizard** captures branding and the initial super-admin account before the shell becomes operational.

The shell is founded on a fork of an existing Next.js + Shadcn admin starter — extended, not built from scratch.

---

## 2. Problem Statement

As internal tooling grows, organizations accumulate disconnected applications with separate logins, inconsistent navigation, and no unified access control. The shell solves this by providing one login, one navigation surface, one access control layer, and a clean contract for plugging in any future React application — all hosted on AWS with near-zero idle costs.

---

## 3. Goals

| # | Goal |
|---|------|
| G1 | SSO via Okta (OIDC) at launch; generic OIDC support for future IDPs without code changes |
| G2 | Data-driven left sidebar navigation, gated by role and subscription tier |
| G3 | Micro-frontend hosting via Module Federation; child apps deploy independently |
| G4 | Admin panel covering menus, roles, users, apps, subscriptions, SSO status, and branding |
| G5 | First-run setup wizard to configure app name, logo, brand color, and initial super-admin |
| G6 | Shell SDK + CLI published to GitHub Packages for child app teams |
| G7 | All infrastructure (shell + child apps) on a single AWS account, managed by SST v3 |
| G8 | Cost-effective at ≤1,000 concurrent users; target <$50/month per 100 active users |
| G9 | Fork-and-extend from `satnaing/shadcn-admin` — not built from scratch |

## 4. Non-Goals (v1)

| # | Non-Goal | Planned For |
|---|----------|-------------|
| NG1 | iFrame integration mode for non-React / third-party apps | v2 |
| NG2 | Audit log viewer in Admin Panel (events written to DB in v1) | v2 |
| NG3 | Subdomain-based multi-tenant routing (`acme.corp.com`) | v2 |
| NG4 | Self-serve billing / payment gateway (webhook endpoint stubbed) | v2 |
| NG5 | Dynamic IDP registration via Admin Panel (env-var config in v1) | v2 |
| NG6 | Mobile native apps | — |

---

## 5. User Personas

### 5.1 End User
A corporate employee who logs in via Okta. Sees only the menu items their role and subscription tier permit. Navigates between internal tools without re-authenticating. The shell feels like one coherent product.

### 5.2 Application Developer
Builds a new internal React application. Runs `npx @corp/create-shell-app` to scaffold a pre-wired project, deploys it independently to S3/CloudFront (GitHub Actions), then registers it in the Admin Panel. No shell code changes required. Target onboarding time: **under 2 hours**.

### 5.3 Administrator
Manages shell configuration via the Admin Panel. Adds child apps, creates menu items, assigns roles and subscription tiers. Requires **zero engineering involvement** for routine config changes.

### 5.4 First-Time Setup User (super-admin)
The person who completes the **first-run wizard** immediately after the shell is first deployed. They set the app name, upload a logo, choose a brand color, and create the initial `super_admin` account linked to their Okta identity. The wizard is only accessible once; subsequent access requires the `super_admin` role.

---

## 6. Functional Requirements

### 6.1 First-Run Setup Wizard

**FR-SETUP-1:** On first deployment, the shell detects that no `shell_config` record exists in the database and redirects all traffic to `/setup`.

**FR-SETUP-2:** The wizard is a multi-step flow:

| Step | Fields |
|------|--------|
| 1 — Branding | App name (text), Logo (image upload → S3), Primary brand color (color picker) |
| 2 — Okta Connection | Okta domain (e.g. `corp.okta.com`), Client ID, Client Secret, (auto-derives issuer URL as `https://{domain}/oauth2/default`) |
| 3 — Super Admin | Enter the Okta email address that will be granted `super_admin` — verified by completing an Okta login within the wizard |
| 4 — Review & Launch | Summary of all inputs; "Launch" button writes config to DB and marks setup as complete |

**FR-SETUP-3:** Once the wizard is completed, `/setup` returns 404 for all users — including `super_admin`. The route is permanently closed.

**FR-SETUP-4:** If Okta cannot be reached during Step 2 (OIDC discovery check fails), the wizard shows an inline error with the exact failure reason. The wizard does not proceed until the connection is valid.

**FR-SETUP-5:** Logo uploaded in the wizard is stored in a private S3 bucket and served via CloudFront with a signed URL. Branding is thereafter editable in Admin Panel → Theme.

### 6.2 Authentication & SSO

**FR-AUTH-1:** The shell authenticates via **Okta using OIDC (authorization code + PKCE)**. NextAuth.js v5 handles the full flow natively via its built-in Okta provider.

**Okta configuration (set during wizard, stored in Secrets Manager):**
```
OKTA_DOMAIN=corp.okta.com
OKTA_CLIENT_ID=<from Okta app registration>
OKTA_CLIENT_SECRET=<from Okta app registration>
# Issuer auto-derived: https://corp.okta.com/oauth2/default
```

**Okta app registration requirements (documented for the admin):**
- Application type: Web, OIDC
- Grant type: Authorization Code
- Redirect URI: `https://app.corp.com/api/auth/callback/okta`
- Sign-out redirect URI: `https://app.corp.com`
- Scopes requested: `openid profile email groups`

**FR-AUTH-2:** The `groups` claim from Okta is enabled at the Okta org level (Authorization Server → Claims → add `groups` claim to ID token). The shell reads this claim to map Okta groups to shell roles.

**FR-AUTH-3:** Adding a second OIDC provider in the future (Azure AD, Google Workspace, etc.) requires adding a new NextAuth.js provider entry and environment variables. No structural code changes needed.

**FR-AUTH-4:** On first login from a new Okta user, a user record is JIT-provisioned in the database. Okta groups are mapped to shell roles and the user is assigned the `free` subscription tier.

**FR-AUTH-5:** Sessions are stored as encrypted JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Tokens never touch `localStorage` or JavaScript-accessible storage.

**FR-AUTH-6:** Silent token refresh is handled by NextAuth.js. Users are not redirected to Okta while their session is valid.

**FR-AUTH-7:** Logout calls NextAuth.js signOut, which revokes the local session and initiates Okta RP-Initiated Logout (`/v1/logout`) to end the Okta session too.

**FR-AUTH-8:** Authentication events (login, logout, failure, JIT provision) are written to the `auth_events` table. Admin viewer UI is v2.

### 6.3 Authorization & RBAC

**FR-RBAC-1:** The shell maintains its own role registry. Roles are slugs (e.g. `finance_manager`) created by admins, independent of Okta group names.

**FR-RBAC-2:** Okta groups are mapped to shell roles in the Admin Panel (Role Manager → IDP Mappings). Example: Okta group `"Finance"` → shell role `finance_manager`. Mapping is applied in the NextAuth.js `jwt` callback on every login.

**FR-RBAC-3:** Menu items require zero or more roles. Empty = visible to all authenticated users.

**FR-RBAC-4:** Route guard: direct URL navigation to a restricted route renders a `403 — Access Denied` page. No redirect loops.

**FR-RBAC-5:** Users can hold multiple roles. Effective access is the union.

**FR-RBAC-6:** The `super_admin` role is system-owned. It cannot be deleted, renamed, or removed from a user who created it via the wizard (to prevent lockout).

**FR-RBAC-7:** Roles can be assigned manually by an `admin` or `super_admin` in User Manager, or inherited automatically from Okta groups on login.

### 6.4 Navigation Shell & Menu System

**FR-NAV-1:** Persistent left sidebar with collapse-to-icons mode. Collapse state persisted per user in the database.

**FR-NAV-2:** Fully data-driven menu — all items in the database, none hardcoded.

**FR-NAV-3:** Two hierarchy levels: **sections** (groups with optional label + icon) and **items** (leaf links, optionally with one level of sub-items).

**FR-NAV-4:** Each menu item has: `label`, `icon` (Lucide name), `routeType` (`internal` | `external`), `route`, `requiredRoles[]`, `requiredSubscriptionLevel` (integer, 0 = all), `badge` (optional string), `sortOrder`, `isEnabled`.

**FR-NAV-5:** Top header bar: configurable app logo and name (from DB, set in wizard / Admin Panel), breadcrumb trail, user avatar dropdown (name, roles, logout), notification slot for child apps.

**FR-NAV-6:** Light/dark mode toggle; theme persisted per user in DB.

**FR-NAV-7:** Admin Panel menu editor: full CRUD, drag-and-drop reorder, live role-filtered preview.

### 6.5 Child Application Integration — Module Federation

**Integration mode in v1: Module Federation only.** iFrame fallback is v2.

#### Architecture Boundary
- Shell **layout** (sidebar, header, auth gate) → Next.js Server Components
- Child app mount → Client Component boundary (`"use client"`)
- Child apps are loaded via `React.lazy` + `dynamic import()` from federated remotes
- `ssr: false` on all dynamic imports (MF remotes are client-side only)

#### FR-INT-1: Shell as MF Host
Shell `next.config.js` uses `@module-federation/nextjs-mf`. Registered remotes are loaded from the database via a Next.js server API route and injected into the MF config at startup. Cache TTL: 60 seconds — no redeployment needed when a new child app is registered.

#### FR-INT-2: Child App Manifest
Each child app exposes `{remoteUrl}/mf-manifest.json`:

```typescript
interface ChildAppManifest {
  name: string;          // Unique MF remote name, e.g. "inventoryApp"
  version: string;       // Semver
  routePrefix: string;   // e.g. "/inventory" — globally unique
  routes: {
    path: string;        // Relative to routePrefix
    label: string;       // For breadcrumbs
  }[];
}
```

#### FR-INT-3: Child App Entry Contract
```typescript
// Exposed as 'AppEntry' in child app's webpack MF config
export default function AppEntry(): JSX.Element;
// Rules:
// - Must be a React client component
// - Must not import Next.js-specific APIs (next/navigation, next/image, etc.)
// - Uses Shell SDK for user context, navigation, and theme
```

#### FR-INT-4: Shell SDK — `@corp/shell-sdk`
Published to **GitHub Packages** under the org's GitHub namespace.

```typescript
import {
  useShellUser,     // { id, email, name, roles: string[], subscriptionTier, subscriptionLevel }
  useShellNavigate, // Shell-aware navigate(path: string)
  useShellTheme,    // { mode: 'light' | 'dark', primaryColor: string }
  ShellEventBus,    // emit(event, payload) / on(event, handler) / off(event, handler)
} from '@corp/shell-sdk';
```

Also exports shared Tailwind design token presets so child apps extend the same color/spacing system.

**Publishing:**
```yaml
# .github/workflows/publish-sdk.yml
- run: npm publish --access restricted
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
# Published as: @corp/shell-sdk on GitHub Packages
```

#### FR-INT-5: Shell CLI — `@corp/create-shell-app`
```bash
npx @corp/create-shell-app my-app
```
Scaffolds:
- React 18 + TypeScript + Webpack 5 project
- Module Federation remote config (pre-filled `name`, `filename: 'remoteEntry.js'`)
- `AppEntry.tsx` stub + `mf-manifest.json` template
- `@corp/shell-sdk` pre-installed
- GitHub Actions workflow: on push to `main`, build + upload to `s3://corp-apps/{app-name}/` + CloudFront invalidation
- `README.md` with registration walkthrough

#### FR-INT-6: Child App AWS Hosting (Single Account)
All child apps share the **same AWS account** as the shell. Each app gets:
- A dedicated S3 bucket prefix: `s3://corp-child-apps/{app-name}/`
- A dedicated CloudFront distribution origin path pointing to that prefix
- A CloudFront URL returned by SST after deploy: `https://{distro-id}.cloudfront.net`

This URL is what the admin enters in the Application Registry as the `remoteUrl`. The SST config for child apps is templated in the scaffold and requires only the app name to be changed.

#### FR-INT-7: Error Isolation
Every child app's `AppEntry` is wrapped in a React Error Boundary. Crash or unreachable remote → graceful error view for that route only. Rest of shell unaffected.

### 6.6 Subscription & Entitlement Engine

**FR-SUB-1:** Admins define subscription tiers (e.g. `free`, `standard`, `enterprise`) with a numeric `level`. Higher level = more access.

**FR-SUB-2:** Menu items and child-app feature flags can declare a `requiredSubscriptionLevel`. Users below that level see a configurable Upgrade Prompt page.

**FR-SUB-3:** Subscription tier is resolved at login, embedded in the NextAuth.js session JWT. No per-route DB call needed.

**FR-SUB-4:** `useShellUser().subscriptionLevel` in the SDK lets child apps gate features without additional API calls.

**FR-SUB-5:** Upgrade Prompt page content (headline, body, CTA label, CTA URL) is configurable in Admin Panel → Subscription Tiers.

**FR-SUB-6:** The entitlement API (`POST /api/internal/subscriptions/assign`) accepts a shared-secret-authenticated webhook from any payment provider. Tier changes are applied immediately. Webhook secret is stored in Secrets Manager.

**FR-SUB-7:** Admins can set `subscriptionExpiresAt` per user. On expiry, the user is downgraded to `free` on next login.

### 6.7 Admin Panel

Accessible to `super_admin` and `admin` roles only. All sections are reachable from a dedicated "Admin" section in the sidebar, hidden from other roles.

| Section | Capabilities |
|---------|-------------|
| **Menu Manager** | Full CRUD for sections and items. Drag-and-drop reorder. Inline role + subscription level assignment. Live role-filtered menu preview. |
| **Role Manager** | Create/rename/delete roles. Define Okta group → shell role mappings. View users per role. |
| **User Manager** | View all JIT-provisioned users. Assign/revoke roles. Set subscription tier + expiry. View last login + Okta source. Deactivate users. |
| **SSO Status** | Read-only display of current Okta OIDC config (domain, client ID). Live reachability check (pings `https://{domain}/.well-known/openid-configuration`). Shows "Connected ✓" or error detail. |
| **Application Registry** | Register/update/remove child apps. Validate manifest. Map routes to menu items. Live health status indicator. |
| **Subscription Tiers** | Create/rename/delete tiers. Set numeric level. Configure Upgrade Prompt content per tier. |
| **Theme & Branding** | Edit app name, re-upload logo, change primary brand color. Live preview. Changes apply globally without redeployment. |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Performance | Shell initial load < 2s (P95) on 10 Mbps |
| NFR-2 | Performance | Child app cold load via MF < 1.5s (P95) |
| NFR-3 | Availability | 99.9% uptime; child app failure must not crash the shell |
| NFR-4 | Scalability | 1,000 concurrent authenticated sessions, no infra changes |
| NFR-5 | Security | All tokens in encrypted `httpOnly` cookies only |
| NFR-6 | Security | CSRF protection via NextAuth.js on all state-mutating routes |
| NFR-7 | Security | Admin routes require `super_admin` or `admin` on every request (no client-side-only guard) |
| NFR-8 | Security | Webhook endpoint validates HMAC-SHA256 signature with shared secret from Secrets Manager |
| NFR-9 | Accessibility | WCAG 2.1 AA on all shell-owned UI |
| NFR-10 | Observability | Structured JSON logs to CloudWatch Logs; Next.js `instrumentation.ts` for request tracing |
| NFR-11 | Cost | < $50/month per 100 active users at ≤1,000 concurrent users |
| NFR-12 | Maintainability | Shell SDK versioned with semver; breaking changes = major bump + migration guide |

---

## 8. Technical Architecture

### 8.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Shell Framework | Next.js 15 (App Router) | SSR for layout/auth, API routes replace separate backend, native Lambda support via SST |
| UI Components | Shadcn/ui + Tailwind CSS v4 | Per requirements; headless, accessible |
| Module Federation | `@module-federation/nextjs-mf` | Proven Next.js + MF; maintained by MF core team |
| Authentication | NextAuth.js v5 (Auth.js) | First-class Next.js + Okta OIDC; session in httpOnly cookie |
| State | Zustand | Lightweight; shell state is simple |
| ORM | Drizzle ORM | Type-safe; serverless-safe (no persistent connection pool) |
| Database | Amazon Aurora Serverless v2 (PostgreSQL) | Scales to zero in dev; SQL for relational admin queries; single DB for all shell data |
| CDN / Static | AWS CloudFront + S3 | Shell SPA assets + child app remoteEntry.js files |
| Compute | AWS Lambda via SST v3 | Serverless Next.js; scales to zero; no EC2/ECS |
| DNS | Amazon Route 53 | Custom domain, SSL, health checks |
| Secrets | AWS Secrets Manager | Okta client secret, webhook HMAC secret, DB credentials |
| IaC | SST v3 (Ion) | Deploys Next.js on Lambda + CloudFront + S3 + Route 53 in one config file |
| CI/CD | GitHub Actions | Shell and each child app deploy independently |
| Package Registry | GitHub Packages | `@corp/shell-sdk` and `@corp/create-shell-app` |

### 8.2 System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     End User Browser                           │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           Shell — Next.js 15 App Router                  │  │
│  │                                                          │  │
│  │  Server Components          Client Components            │  │
│  │  ─────────────────          ──────────────────           │  │
│  │  RootLayout                 ContentArea ("use client")   │  │
│  │   ├─ auth session check      └─ MF dynamic import()      │  │
│  │   ├─ menu fetch (DB)            └─ <AppEntry />          │  │
│  │   ├─ role/sub filter               (child app)           │  │
│  │   └─ Sidebar + Header          wrapped in ErrorBoundary  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│        Shell SDK context flows into child apps via            │
│        ShellSDKProvider → useShellUser/Theme/Navigate         │
└───────────────────────────────────────────────────────────────┘
         │ OIDC (PKCE)                     │ HTTPS
         ▼                                 ▼
┌──────────────────────┐     ┌─────────────────────────────────┐
│  Okta                │     │  Lambda — Next.js API Routes     │
│  corp.okta.com       │     │                                  │
│                      │     │  /api/auth/[...nextauth]         │
│  Authorization Server│     │  /api/menu                       │
│  + groups claim      │     │  /api/users                      │
│  + RP-Initiated      │     │  /api/roles                      │
│    Logout            │     │  /api/apps                       │
└──────────────────────┘     │  /api/subscriptions              │
                             │  /api/admin/*                    │
                             │  /api/internal/webhooks          │
                             └────────────────┬────────────────┘
                                              │ Drizzle ORM
                                              ▼
                             ┌────────────────────────────────┐
                             │  Aurora Serverless v2           │
                             │  PostgreSQL (VPC private)       │
                             │                                 │
                             │  users             roles        │
                             │  user_roles        user_subs    │
                             │  menu_sections     menu_items   │
                             │  app_registry      sub_tiers    │
                             │  idp_group_maps    shell_config │
                             │  auth_events (v2 viewer)        │
                             └────────────────────────────────┘

AWS Account (single, managed by SST v3)
───────────────────────────────────────
CloudFront ──→ Lambda@Edge   (shell SSR + API)
CloudFront ──→ S3            (shell static assets)
CloudFront ──→ S3 prefix     (child app A: remoteEntry.js + assets)
CloudFront ──→ S3 prefix     (child app B: remoteEntry.js + assets)
Route 53   ──→ CloudFront    (app.corp.com + SSL)
Secrets Manager              (OKTA_CLIENT_SECRET, WEBHOOK_SECRET, DB_URL)
Aurora Serverless v2         (private subnet, VPC)
```

### 8.3 SST v3 Project Structure

```
/
├── sst.config.ts          # SST Ion config — defines all AWS resources
├── shell/                 # Next.js shell app (fork of satnaing/shadcn-admin)
│   ├── app/
│   │   ├── layout.tsx           # Root layout (server): auth, menu, sidebar
│   │   ├── (auth)/              # Login, callback, error routes
│   │   ├── (shell)/             # Protected routes
│   │   │   ├── dashboard/
│   │   │   ├── admin/           # Admin panel pages
│   │   │   │   ├── menu/
│   │   │   │   ├── roles/
│   │   │   │   ├── users/
│   │   │   │   ├── apps/
│   │   │   │   ├── subscriptions/
│   │   │   │   ├── sso/
│   │   │   │   └── branding/
│   │   │   └── [...slug]/       # Child app catch-all (client component)
│   │   └── setup/               # First-run wizard (locked after completion)
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth.js handler
│   │   ├── menu/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── apps/
│   │   ├── subscriptions/
│   │   ├── admin/
│   │   └── internal/
│   │       └── webhooks/        # Payment provider webhook
│   ├── components/
│   │   ├── shell/               # Sidebar, Header, Breadcrumbs, ErrorBoundary
│   │   └── ui/                  # Shadcn components
│   ├── lib/
│   │   ├── auth.ts              # NextAuth.js config + Okta provider
│   │   ├── db/                  # Drizzle ORM client + schema
│   │   └── mf/                  # Module Federation remote loader
│   └── middleware.ts            # Auth + role guard for all protected routes
├── packages/
│   ├── shell-sdk/               # @corp/shell-sdk (published to GitHub Packages)
│   └── create-shell-app/        # @corp/create-shell-app CLI
└── stacks/
    └── child-app-stack.ts       # Reusable SST stack for child app S3+CloudFront
```

### 8.4 Authentication Flow (Okta OIDC via NextAuth.js v5)

```
1.  User visits app.corp.com
2.  Next.js middleware (middleware.ts) checks for valid session cookie
3.  No session → NextAuth.js redirects to:
      https://corp.okta.com/oauth2/default/v1/authorize
        ?client_id=...&scope=openid profile email groups
        &code_challenge=...&code_challenge_method=S256
        &redirect_uri=https://app.corp.com/api/auth/callback/okta
4.  User authenticates at Okta
5.  Okta redirects to /api/auth/callback/okta with auth code
6.  NextAuth.js exchanges code for tokens at Okta token endpoint (PKCE)
7.  NextAuth.js jwt() callback fires:
      a. Extract groups[] from ID token
      b. Query DB: map Okta groups → shell roles
      c. Query DB: get user's subscription tier
      d. If new user: INSERT users, INSERT user_roles, INSERT user_subscriptions
      e. Write auth_event (LOGIN) to DB
      f. Embed { userId, roles, subscriptionTier, subscriptionLevel } in JWT
8.  Encrypted session cookie written (httpOnly, Secure, SameSite=Lax)
9.  User redirected to originally requested URL (or /dashboard)
10. Shell RootLayout (server): auth() → reads session → fetches menu
      → filters by roles + subscriptionLevel → renders sidebar
11. User sees their personalized shell
```

### 8.5 First-Run Wizard Flow

```
Deploy shell to AWS (SST deploy)
  ↓
User visits app.corp.com
  ↓
Shell checks: does shell_config row exist in DB?
  ↓ No
Redirect to /setup
  ↓
Step 1 — Branding
  App name, logo upload (→ S3), primary color
  ↓
Step 2 — Okta Connection
  Okta domain, Client ID, Client Secret
  Shell pings https://{domain}/.well-known/openid-configuration
  ✓ Connected → proceed  |  ✗ Error → show failure, stay on step
  ↓
Step 3 — Super Admin
  Enter Okta email for super_admin account
  User clicks "Verify via Okta Login" → completes Okta auth flow inline
  NextAuth.js session created → verified email matches input
  ✓ Match → proceed  |  ✗ Mismatch → show error, retry
  ↓
Step 4 — Review & Launch
  Summary card of all inputs
  "Launch Shell" button:
    → INSERT shell_config (branding + Okta config)
    → INSERT user (super admin)
    → INSERT user_roles (super_admin role)
    → INSERT subscription (enterprise tier, no expiry)
    → INSERT default subscription tiers (free, standard, enterprise)
    → Mark setup complete (shell_config.setup_complete = true)
  ↓
Redirect to /dashboard
/setup now returns 404 for everyone
```

### 8.6 Module Federation — Implementation Detail

```typescript
// shell/next.config.ts
import NextFederationPlugin from '@module-federation/nextjs-mf';

// Loaded from DB at build time (or via runtime API on shell startup)
const remotes = await fetchRegisteredApps(); // → { inventoryApp: '...@.../remoteEntry.js' }

export default {
  webpack(config) {
    config.plugins.push(new NextFederationPlugin({
      name: 'shell',
      remotes,
      shared: {
        react:           { singleton: true, requiredVersion: '^18' },
        'react-dom':     { singleton: true, requiredVersion: '^18' },
        '@corp/shell-sdk': { singleton: true },
      },
    }));
    return config;
  },
};

// shell/app/(shell)/[...slug]/page.tsx
'use client';
import { useShellRouting } from '@/lib/mf/router';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';
import { Suspense } from 'react';
import { AppSkeleton } from '@/components/shell/AppSkeleton';

export default function ChildAppPage() {
  const AppEntry = useShellRouting(); // resolves which MF remote owns this route

  return (
    <ErrorBoundary fallback={<AppErrorView />}>
      <Suspense fallback={<AppSkeleton />}>
        <AppEntry />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### 8.7 Database Schema (Drizzle ORM / PostgreSQL)

```typescript
// packages referenced as @/lib/db/schema.ts

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  displayName:  text('display_name'),
  idpSource:    text('idp_source').notNull(),     // e.g. 'okta'
  idpSubject:   text('idp_subject').notNull(),     // Okta 'sub' claim
  isActive:     boolean('is_active').default(true),
  createdAt:    timestamp('created_at').defaultNow(),
  lastLoginAt:  timestamp('last_login_at'),
});

export const subscriptionTiers = pgTable('subscription_tiers', {
  id:          text('id').primaryKey(),            // e.g. 'enterprise'
  displayName: text('display_name').notNull(),
  level:       integer('level').notNull(),          // 0=free, 1=standard, 2=enterprise
  description: text('description'),
  upgradeCta:  text('upgrade_cta'),                // CTA label on upgrade prompt
  upgradeUrl:  text('upgrade_url'),                // CTA URL on upgrade prompt
});

export const userSubscriptions = pgTable('user_subscriptions', {
  userId:     uuid('user_id').primaryKey().references(() => users.id),
  tierId:     text('tier_id').references(() => subscriptionTiers.id),
  assignedBy: uuid('assigned_by'),
  assignedAt: timestamp('assigned_at').defaultNow(),
  expiresAt:  timestamp('expires_at'),
});

export const roles = pgTable('roles', {
  id:          text('id').primaryKey(),            // slug
  displayName: text('display_name').notNull(),
  description: text('description'),
  isSystem:    boolean('is_system').default(false), // true for super_admin
});

export const userRoles = pgTable('user_roles', {
  userId:     uuid('user_id').references(() => users.id),
  roleId:     text('role_id').references(() => roles.id),
  assignedBy: text('assigned_by').notNull(),        // UUID or 'idp_sync'
  assignedAt: timestamp('assigned_at').defaultNow(),
}, (t) => ({ pk: primaryKey(t.userId, t.roleId) }));

export const idpGroupRoleMappings = pgTable('idp_group_role_mappings', {
  idpProvider: text('idp_provider').notNull(),      // 'okta'
  idpGroup:    text('idp_group').notNull(),          // Okta group name
  roleId:      text('role_id').references(() => roles.id),
}, (t) => ({ pk: primaryKey(t.idpProvider, t.idpGroup, t.roleId) }));

export const menuSections = pgTable('menu_sections', {
  id:        uuid('id').primaryKey().defaultRandom(),
  label:     text('label').notNull(),
  icon:      text('icon'),
  sortOrder: integer('sort_order').default(0),
  isEnabled: boolean('is_enabled').default(true),
});

export const menuItems = pgTable('menu_items', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  sectionId:              uuid('section_id').references(() => menuSections.id),
  parentItemId:           uuid('parent_item_id'),
  label:                  text('label').notNull(),
  icon:                   text('icon'),
  routeType:              text('route_type').notNull(),  // 'internal' | 'external'
  route:                  text('route').notNull(),
  requiredRoles:          text('required_roles').array().default(sql`'{}'`),
  requiredSubLevel:       integer('required_sub_level').default(0),
  badge:                  text('badge'),
  sortOrder:              integer('sort_order').default(0),
  isEnabled:              boolean('is_enabled').default(true),
});

export const appRegistry = pgTable('app_registry', {
  id:             uuid('id').primaryKey().defaultRandom(),
  name:           text('name').notNull(),
  remoteUrl:      text('remote_url').notNull(),
  routePrefix:    text('route_prefix').notNull().unique(),
  healthCheckUrl: text('health_check_url'),
  isEnabled:      boolean('is_enabled').default(true),
  lastHealthyAt:  timestamp('last_healthy_at'),
  registeredAt:   timestamp('registered_at').defaultNow(),
});

export const shellConfig = pgTable('shell_config', {
  id:           uuid('id').primaryKey().defaultRandom(),
  appName:      text('app_name').default('Corporate Shell'),
  logoUrl:      text('logo_url'),
  primaryColor: text('primary_color').default('#0f172a'),
  setupComplete: boolean('setup_complete').default(false),
  updatedAt:    timestamp('updated_at').defaultNow(),
  // Okta config stored in Secrets Manager; only non-secret fields here:
  oktaDomain:   text('okta_domain'),
});

export const authEvents = pgTable('auth_events', {
  id:        uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  userId:    uuid('user_id'),
  idpSource: text('idp_source'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 8.8 Cost Estimate (≤1,000 Concurrent Users)

| Service | Configuration | Est. Monthly (prod) |
|---------|--------------|---------------------|
| Aurora Serverless v2 | 0.5–2 ACUs, auto-pause in dev/staging | $15–40 |
| Lambda (Next.js via SST) | ~5M req/mo, 128MB, ~200ms avg | ~$5 |
| CloudFront + S3 (shell) | ~100GB transfer/mo | ~$10 |
| CloudFront + S3 (per child app) | ~10GB/mo each | ~$3/app |
| Route 53 | 1 hosted zone | ~$0.50 |
| Secrets Manager | ~5 secrets | ~$2 |
| **Total — shell + 3 child apps** | | **~$75–100/mo prod** |

Dev/staging: near zero — Aurora pauses to 0 ACUs, Lambda scales to zero.

---

## 9. Starter Repository — Fork Strategy

### Base: `satnaing/shadcn-admin`

| What it provides (free) | What we build on top |
|------------------------|---------------------|
| Sidebar with collapse, keyboard shortcuts, mobile drawer | NextAuth.js v5 + Okta OIDC |
| Top header with breadcrumbs and user menu | Drizzle ORM + Aurora schema + migrations |
| All Shadcn/ui components styled with Tailwind v4 | Data-driven menu (DB replaces hardcoded nav) |
| Dark/light mode with persistence | RBAC middleware (`middleware.ts`) |
| Clean TypeScript folder structure | Module Federation host config |
| | Admin Panel pages (all 7 sections) |
| | First-run setup wizard |
| | Shell SDK + CLI (GitHub Packages) |
| | SST v3 deployment config |

**Migration path (Vite → Next.js):**
1. Scaffold fresh Next.js 15 project (Tailwind v4, Shadcn/ui)
2. Copy sidebar, header, layout components from `satnaing/shadcn-admin` — Shadcn is framework-agnostic, minimal changes needed
3. Layer auth, DB, MF, admin panel on top

---

## 10. User Flows

### 10.1 First-Time Deployment
1. Engineer runs `npx sst deploy --stage prod`
2. SST provisions CloudFront, Lambda, S3, Route 53, Aurora, Secrets Manager
3. Engineer visits `app.corp.com` → redirected to `/setup`
4. Completes 4-step wizard (branding → Okta → super admin → launch)
5. Shell is live; `/setup` returns 404 permanently

### 10.2 Employee First Login (JIT Provisioning)
1. Employee visits `app.corp.com` → no session → Okta login
2. Authenticates at `corp.okta.com`
3. Callback → NextAuth.js provisions user, maps Okta groups to roles, assigns `free` tier
4. Menu rendered filtered to their roles and tier
5. Employee navigates without re-authenticating

### 10.3 Developer Onboards a New Child App
1. `npx @corp/create-shell-app inventory-app`
2. Develops app; pushes to GitHub → Actions deploys `remoteEntry.js` to S3/CloudFront
3. Copies CloudFront URL from Actions output
4. Opens Admin Panel → Application Registry → Add App
5. Pastes URL, enters route prefix `/inventory`, clicks "Validate & Fetch Manifest"
6. Maps routes to sidebar menu items, sets roles/subscription level, saves
7. App is live for permitted users within 60 seconds — zero shell changes

### 10.4 Admin Adjusts Access
1. New employee joins Finance team in Okta
2. Okta group `Finance` already mapped to shell role `finance_manager`
3. Employee logs in → JIT provisioning applies role automatically
4. Employee immediately sees Finance menu items — no admin intervention needed

### 10.5 Subscription Upgrade Prompt
1. User navigates to route requiring `standard` tier; user has `free`
2. Shell resolves `session.subscriptionLevel < requiredLevel`
3. Upgrade Prompt page shown (admin-configured headline + CTA)
4. Admin upgrades user in User Manager → access granted on next request

---

## 11. v2 Roadmap

| Feature | Notes |
|---------|-------|
| iFrame fallback integration mode | For non-React / third-party apps; adds CSP and postMessage auth |
| Audit log Admin Panel viewer | Events already in DB from v1 |
| Subdomain multi-tenant routing | `acme.corp.com` → per-tenant CloudFront + Okta org |
| Self-serve billing | Stripe / Chargebee webhook already stubbed in v1 |
| Dynamic IDP registration via Admin Panel | No-redeploy IDP add/remove |
| Organization-level subscription management | Group billing, org admin role, seat counts |

---

## 12. Decisions Log

All open questions are resolved. No outstanding items.

| Question | Decision |
|----------|----------|
| Child app integration mode | Module Federation (primary); iFrame in v2 |
| SSO provider | Okta via OIDC; generic OIDC for future IDPs |
| Subscription management | Admin-managed v1; payment webhook endpoint stubbed for v2 |
| Concurrent users | ≤1,000 → Aurora Serverless v2 On-Demand, Lambda, no Redis |
| First OIDC IDP | Okta — NextAuth.js Okta provider used; domain/client ID from wizard |
| AWS account structure | Single account for shell + all child apps |
| npm registry | GitHub Packages — `@corp/shell-sdk`, `@corp/create-shell-app` |
| Branding / naming | Captured in first-run setup wizard on first deploy |

---

## 13. Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Child app onboarding (scaffold → navigable) | < 2 hours | Developer time-on-task |
| Shell initial load (P95) | < 2 seconds | CloudWatch RUM |
| Child app cold load via MF (P95) | < 1.5 seconds | CloudWatch RUM |
| Okta SSO login success rate | > 99.5% | NextAuth.js + CloudWatch error logs |
| Admin task completion without documentation | > 90% | Usability test |
| Monthly AWS cost per 100 active users | < $50 | AWS Cost Explorer |
| Shell availability | > 99.9% | Route 53 health check |
| First-run wizard completion rate | 100% (blocking gate) | DB: shell_config.setup_complete |

---

*End of PRD v1.2 — Ready for Engineering*
