# Contributing to corp-shell

## Local development setup

### Prerequisites

- Node 22 LTS
- pnpm 9.x+
- Docker (for local PostgreSQL)

### Steps

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-org/corp-shell.git
   cd corp-shell
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start PostgreSQL**
   ```bash
   docker compose up -d
   ```

4. **Configure environment**
   ```bash
   cp shell/.env.local.example shell/.env.local
   # Edit shell/.env.local:
   #   - Set NEXTAUTH_SECRET (openssl rand -base64 32)
   #   - Set ENCRYPTION_KEY (openssl rand -hex 32)
   #   - Leave ENCRYPTION_PROVIDER=local and STORAGE_PROVIDER=local
   #   - DATABASE_URL is pre-filled for the Docker Compose defaults
   ```

5. **Run database migrations**
   ```bash
   pnpm drizzle-kit migrate
   ```

6. **Start the dev server**
   ```bash
   pnpm --filter shell dev
   ```

7. Open `http://localhost:3000` — you should be redirected to `/setup`.

No AWS credentials are required for local development.

## Running tests

```bash
pnpm --filter shell test
```

## Linting and type checking

```bash
pnpm lint
pnpm typecheck
```

## Branching model

- Branch from `main` for every change: `git checkout -b feat/my-feature`
- Open a pull request targeting `main`
- Squash-merge after review

## PR checklist

Before requesting review, verify:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm --filter shell test` passes
- [ ] New behaviour is covered by tests (or explain why it cannot be)
- [ ] No secrets or credentials added to source files
- [ ] `specs/ROADMAP.md` updated if a milestone task was completed

## Coding conventions

- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`)
- ESLint flat config — run `pnpm lint` before pushing
- No comments unless the *why* is non-obvious
- Small, focused functions; explicit over implicit
- No unused imports, variables, or exports
- Domain language from `specs/PRD.md` used in identifiers

## Spec-driven development

No application code is written without an approved spec. See `CLAUDE.md` for the phase gate order.
