# Changelog

All notable changes to corp-shell are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **M19-7** — Platform menu seeded from database on bootstrap; platform admins can now manage their own navigation via the Menu Manager UI (`/platform/menu`) like any other tenant
- **M20** — Company hierarchy: unlimited-depth organizational tree per tenant
- Company switcher dropdown in shell header (top-left, tree-indented, search for >8 companies)
- Admin UI for managing company tree (`/admin/companies`) and user company assignments
- User access scoped to assigned companies and all descendants via closure table (`company_ancestors`)
- `PUT /api/users/me/company` endpoint for active company switching (cookie-based)

---

## [2.1.0] — 2026-05-26

### Changed

- **M3** — Replaced first-run setup wizard with auto-bootstrap: platform tenant auto-provisions on first visit; platform OIDC configured via env vars (`PLATFORM_OIDC_ISSUER`, `PLATFORM_OIDC_CLIENT_ID`, `PLATFORM_OIDC_CLIENT_SECRET`); first user to log in becomes super admin
- **M19** — Platform tenant creation now includes full OIDC configuration (issuer, client ID, client secret) and optional branding; removed per-tenant setup wizard

### Added

- Platform admin invite capability (`/platform/admins` page + API)
- Sidebar links to "Tenants" and "Platform Admins" for platform super admins
- OIDC connection validation during tenant creation

### Removed

- Setup wizard (`/setup` route and all associated API endpoints)
- `bootstrap-platform.ts` CLI script — no longer needed

---

## [2.0.0] — 2026-05-24

### Added

- **M16** — Multi-tenant data model: schema-per-tenant; `withTenant()` Drizzle factory; `provisionTenant()` provisioning function; `public.tenants` table; `tenantSubscription` and `idpProviders` per-tenant tables
- **M17** — Subdomain routing + tenant JWT: host-based login boundary; `tenantSlug` and `tenantId` in signed JWT; cross-tenant token replay protection; `/suspended` page
- **M18** — Dynamic IDP registration: `getAuthConfig(tenantSlug)` loads enabled OIDC providers from DB at login time; multi-IDP admin UI; per-tenant SSO CRUD API
- **M19** — Platform admin tenant management: `isPlatformAdmin()` guard; `/platform/tenants` panel with create/suspend/delete; `GET /api/admin/subscriptions/current` org-level subscription endpoint; subscriptions admin page shows org tier with upgrade CTA

---

## [1.0.0] — 2026-05-23

### Added

- **M1** — pnpm monorepo scaffold; Next.js 16 shell app; TypeScript strict mode; AWS Amplify hosting
- **M2** — Drizzle ORM; PostgreSQL schema (11 tables); automated migrations
- **M3** — First-run setup (superseded in v2.1.0 by auto-bootstrap)
- **M4** — NextAuth.js v5 OIDC authentication; JIT user provisioning; JWT callbacks; RP-initiated logout
- **M5** — RBAC middleware; admin route guard; `requireRoles()` helper; 403 page
- **M6** — Data-driven sidebar (DB-backed, role/tier-filtered); header with breadcrumbs, user dropdown, theme toggle; collapse state persistence
- **M7** — Admin Panel with 7 sections: Menu Manager, Role Manager, User Manager, SSO Status, Application Registry, Subscription Tiers, Theme & Branding
- **M8** — Module Federation host (runtime script federation); child app mount page; `ShellSDKProvider`; error boundary
- **M9** — `@corp/shell-sdk` package (hooks, event bus, Tailwind preset); `@corp/create-shell-app` CLI scaffolder; GitHub Packages publish pipelines
- **M10** — Subscription & entitlement engine; upgrade prompt; subscription expiry enforcement; HMAC-signed webhook endpoint
- **M11** — Structured JSON logging; X-Ray request tracing; CSP and security headers
- **M12** — Performance and load validation (P95 LCP < 2s; MF cold load < 1.5s; 1000 concurrent sessions)
- **M13** — Notifications system: bell icon, unread badge, SSE real-time push, toast notifications, admin page, session-auth push API for child apps
- **M14** — Open-source readiness: local crypto/storage providers; Docker Compose local dev; conditional CSP; OSS contribution files; Vitest test suite
- **M15** — `src/shell` published as `@corp/shell-app`; CLI extended with `init` and `update` subcommands.