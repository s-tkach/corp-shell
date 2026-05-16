# aws-corp-shell-app

## Spec-Driven Development (SDD) Workflow

**No application code is written until the relevant spec exists and is approved.**

### Phase Gate Order

```
1. PRD (Product Requirements Document)   →  specs/PRD.md
2. Architecture Design                   →  specs/ARCHITECTURE.md
3. Roadmap & Step-by-Step Plan           →  specs/ROADMAP.md
4. Implementation (feature by feature)   →  src/
5. Tests                                 →  tests/
```

Each phase must be completed and explicitly confirmed before the next begins. If a requirement changes mid-implementation, update the relevant spec first, then the code.

---

## Project Specs

> Specs live in `specs/`. Do not modify application code to work around a spec — update the spec first.

| File | Status | Description |
|---|---|---|
| `specs/PRD.md` | DONE | Product requirements, goals, non-goals, user stories |
| `specs/ARCHITECTURE.md` | DONE | System design, component boundaries, data flow, tech stack |
| `specs/ROADMAP.md` | DONE | Milestones, phases, ordered task list |

---

## Development Guidelines

### General
- Follow the phase gate order strictly. Do not skip phases.
- Prefer simple, direct implementations — no premature abstractions.
- No feature flags, backwards-compat shims, or dead code.
- Do not add error handling for scenarios that cannot happen.
- Default to no comments; only add one when the *why* is non-obvious.

### Code Style
- Small, focused functions and modules.
- Explicit over implicit.
- No unused variables, imports, or exports.
- Consistent naming that mirrors the domain language in the PRD.

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

> Fill these in once the tech stack is confirmed in `specs/ARCHITECTURE.md`.

```bash
# Install dependencies
# TBD

# Run development server
# TBD

# Run tests
# TBD

# Run linter
# TBD

# Build for production
# TBD
```

---

## Current Status

**Phase: Implementation** — All specs approved. Begin with M1 (Monorepo & Infrastructure Scaffold) per `specs/ROADMAP.md`.

Next step: Execute tasks in milestone order. Do not skip ahead. Update this file's Commands section once the stack is confirmed in M1.
