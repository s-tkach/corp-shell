# corp-shell

## Spec-Driven Development (SDD)

**This is a spec-driven project. All changes — features, bug fixes, architectural decisions — must flow through the spec documents before touching code.**

| File | Purpose |
|---|---|
| `specs/PRD.md` | All product requirements, goals, and user stories |
| `specs/ARCHITECTURE.md` | System design, component boundaries, data flow, tech stack |
| `specs/ROADMAP.md` | Milestones, phases, ordered task list, and completion status |
| `CHANGELOG.md` | Record of all notable changes per release |

- Update the relevant spec first, then the code. Never the other way around.
- Each phase must be completed and confirmed before the next begins.
- All documentation goes in `specs/`. Exception: implementation plans (transient artifacts).

---

## Development Guidelines

### General
- Prefer simple, direct implementations — no premature abstractions.
- No feature flags, backwards-compat shims, or dead code.
- Do not add error handling for scenarios that cannot happen.
- Default to no comments; only add one when the *why* is non-obvious.

### Code Style
- Small, focused functions and modules.
- Explicit over implicit.
- No unused variables, imports, or exports.
- Consistent naming that mirrors the domain language in the PRD.

### Roadmap Tracking
- After completing any roadmap task, mark it `[x]` in `specs/ROADMAP.md` and update `CHANGELOG.md` when a milestone ships.

### Database
- The database is in development — it can be recreated at any time.
- When changing the schema, update the existing migration files in place. Do not generate new migration files.

### Git
- Commit only when explicitly asked.
- Commit messages: concise, present tense, describe *why* not *what*.
- Never force-push, never skip hooks.

### Security
- Validate all user input and external API responses at system boundaries.
- No secrets, credentials, or tokens in source files.
- No dynamic shell command construction from user input.

---

## Commands

```bash
pnpm install                          # Install dependencies
pnpm --filter @corp/shell-app dev     # Run dev server
pnpm --filter @corp/shell-app test    # Run tests
pnpm lint                             # Lint
pnpm typecheck                        # Typecheck
pnpm --filter @corp/shell-app build   # Production build
```
