# Changelog

All notable changes to corp-shell are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-05-23

### Added

- **M1** — pnpm monorepo scaffold; Next.js 16 shell app; TypeScript strict mode; AWS Amplify hosting
- **M2** — Drizzle ORM; PostgreSQL schema (11 tables); automated migrations
- **M3** — First-run setup wizard: branding, OIDC connection, super-admin verification, atomic launch
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