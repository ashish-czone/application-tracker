# Claude Code — Project Instructions

This file is read automatically at the start of every conversation. It defines how you work within this codebase.

---

## Project Vision

This is a **configurable platform base** — not a simple starter template. It is designed to serve as the foundation for building various types of business applications: ERPs, CRMs, marketplaces, project management tools, HR systems, and more.

**Core principle:** Everything should be modular, configurable, and extensible. The platform provides solid infrastructure so that domain-specific features can be built on top without reinventing the wheel.

**Design for:**
- **Configurability** — modules expose config with sensible defaults; runtime settings override them via an admin panel.
- **Extensibility** — new modules can be added without modifying core infrastructure.
- **Multi-tenancy readiness** — data isolation, tenant-scoped config, and per-tenant customization.
- **Enterprise patterns** — audit logging, event-driven side effects, permission-based access control.

Every architectural decision should ask: "Would this work if someone is building a CRM with this? An ERP? A marketplace?" If the answer is no, the approach is too narrow.

### Platform Capabilities Roadmap

**Tier 1 — Core plumbing (build first, everything depends on these):**
1. **Module config + settings system** — typed config per module with defaults; admin-editable overrides stored in DB, cached in memory, invalidated via events.
2. **Multi-tenancy** — tenant model, row-level data isolation, tenant context middleware, tenant-scoped config.
3. **Audit logging** — generic event listener capturing who/what/when/which entity. Built on the event system.
4. **Entity framework / dynamic fields** — extend any entity with custom fields per tenant.

**Tier 2 — Platform capabilities (build alongside features):**
5. **Taxonomy / tags** — polymorphic tagging system attachable to any entity for metadata.
6. **Categories** — hierarchical category trees, attachable to any entity.
7. **State + transitions engine** — admin-configurable workflow states and transitions, attachable to any entity field. Defines allowed transitions, guards, and side effects.
8. **Notification system** — in-app, email. Modules emit events, notification module routes based on user/tenant preferences.
9. **File / media management** — upload, storage abstraction (local/S3), attachments on any entity.
10. **Task / job queue** — background processing for imports, exports, reports, emails (Bull/BullMQ on Redis).

**Tier 3 — UX infrastructure:**
11. **Dynamic navigation** — sidebar items driven by module registration + permissions, not hardcoded.
12. **Table / list framework** — reusable server-side pagination, filtering, sorting patterns.
13. **Form builder foundations** — schema-driven forms that render from config (for dynamic fields + settings).

---

## Project Prompts

This project has detailed architectural and coding prompts. **PROMPT.md is mandatory for every task** — it defines the modular architecture, dependency rules, event system, and database conventions that all code must follow.

| Task | Always read | Also read |
|---|---|---|
| Backend module/feature | PROMPT.md | PROMPT-API.md, PROMPT-TESTING.md |
| Frontend feature | PROMPT.md | PROMPT-UI.md, PROMPT-TESTING.md |
| Full-stack feature | PROMPT.md | PROMPT-API.md, PROMPT-UI.md, PROMPT-TESTING.md |
| Infrastructure/deployment | PROMPT.md | PROMPT-INFRA.md |
| Tests only | PROMPT.md | PROMPT-TESTING.md |

**Never write code without reading the relevant prompts first.** The prompts define architecture, conventions, data handling rules, and test patterns. Violating them creates inconsistency.

---

## Implementation Workflow

Every feature request follows this exact workflow. No shortcuts.

### Step 0: Ensure you are on `main`

Before starting any work, verify you are on the `main` branch with the latest changes:

```bash
git checkout main && git pull
```

**Never start a new feature branch from another feature branch.** Always branch from an up-to-date `main`.

### Step 1: Plan

Before writing any code:

1. Read the relevant prompts (see table above).
2. Read existing code that relates to the feature — understand what's there before changing it.
3. Break the feature into **atomic tasks**. Each task is independently testable and results in one commit.
4. Present the task breakdown to the user for approval before proceeding.

### Step 2: Implement → Test → Commit → PR → Merge (per task)

Work through tasks one at a time, in order. For each task:

```
Implement → Write tests → Run tests → Fix if failing → Commit → Push → Create PR → Merge to main
```

**Tests must pass before committing.** After implementing, run the relevant tests for the module/package you changed:

```bash
# Backend module tests (unit tests in the package + integration tests in apps/api)
pnpm --filter @packages/<package-name> test    # unit tests for the package
pnpm --filter @apps/api test                   # integration tests (requires DB)

# Frontend package tests
pnpm --filter @packages/auth-ui test           # component tests

# All package unit tests (no DB required)
npx turbo run test --filter='@packages/*'
```

If any test fails, fix the issue before committing. Do not skip failing tests.

**After each task is done, immediately create a PR and merge it to `main`.** Do not accumulate multiple tasks on one branch. Each task gets its own branch, its own PR, and is merged before starting the next task.

Before starting the next task, switch back to `main` and pull:

```bash
git checkout main && git pull
```

**Never move to the next task until the current task's PR is merged.**

### Step 3: Audit (after all tasks are complete)

After the final task is merged, run a **supervisor audit agent** to verify the entire feature. Launch a subagent (using the Agent tool) that checks:

1. **Naming consistency** — grep the entire codebase for stale references to old naming (e.g., renamed types, delegates, routes, factories).
2. **Domain boundary violations** — no module accesses another module's database tables or services directly.
3. **Import path correctness** — no broken imports pointing to old/moved file locations.
4. **Type safety** — exported types in package `index.ts` files match what's defined in `types.ts`.
5. **Test coverage** — all new endpoints have security tests (401 + 403), factories and helpers use correct terminology.
6. **Documentation drift** — PROMPT-*.md files reflect current code patterns.

If the audit finds violations, fix them in a new branch, PR, and merge before considering the feature done.

---

## Task Breakdown Pattern

Break features into these standard tasks. Skip tasks that don't apply. Never combine multiple tasks into one.

### Backend feature

| Task | What's included | Tests included |
|---|---|---|
| 1. Schema | Prisma schema + migration | — |
| 2. Service | Service layer + business logic | Unit tests |
| 3. API | Controller + DTOs + route wiring | Integration tests + security tests |
| 4. Events | Event types + emission in service + side-effect wiring | Race condition tests (if applicable) |

### Frontend feature

| Task | What's included | Tests included |
|---|---|---|
| 5. API layer | API functions + TanStack Query hooks | — |
| 6. Components | Feature components (forms, tables, cards) | Component tests (for complex components) |
| 7. Pages | Page containers + route wiring | — |
| 8. E2E | Playwright spec covering CRUD, validation, RBAC, search/filter, pagination, state transitions, cross-module interactions | E2E tests |

### Full-stack feature

Tasks 1–8 in order. Backend first, then frontend, then E2E.

### Infrastructure change

For changes to Docker, CI/CD, environment config — not feature code.

| Task | What's included | Verification |
|---|---|---|
| 1. Config | Docker Compose / Dockerfile / CI pipeline / env files | Build images, start services, verify health checks pass |
| 2. Document | Update `.env.example` if env vars changed, update PROMPT-INFRA.md if architecture changed | — |

### Each task must be:

- **Independently reviewable** — the commit makes sense on its own.
- **Testable** — if the task includes logic, it includes tests.
- **Small** — if a task feels large, split it further.

---

## Git Flow

### Branch naming

```
feat/short-description      — new feature
fix/short-description       — bug fix
chore/short-description     — refactoring, config, dependencies
```

Create the feature branch before the first commit:

```bash
git checkout -b feat/add-candidate-submission
```

### Commit convention

Use Conventional Commits format:

```
feat: add candidate submission service

- Add submitCandidate method with order validation
- Emit CANDIDATES_CANDIDATE_SUBMITTED event
- Add unit tests for submission logic
```

Prefix types:

| Prefix | When |
|---|---|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or fixing tests only |
| `chore` | Config, dependencies, tooling |
| `docs` | Documentation only |

Rules:
- Subject line: imperative mood, lowercase, no period, under 72 characters.
- Body: describe what and why, not how. List key changes as bullet points.
- **Auto-commit after each task.** Do not ask for permission — commit immediately when tests pass.

### Pull requests

Each task gets its own PR, created and merged immediately after the task is done:

1. Push the branch: `git push -u origin feat/add-candidate-submission`
2. Create PR with a summary of the task's changes.
3. PR title follows the same conventional format: `feat: add candidate submission`
4. Merge the PR to `main` immediately.
5. Switch back to `main` and pull before starting the next task.

### Rules

- **Never commit directly to `main`.** Always use a feature branch.
- **Never force-push** unless explicitly asked.
- **Never amend a commit** unless explicitly asked. Create new commits.
- **Code and tests are committed together** — never commit code in one commit and its tests in another.
- **Always start from `main`.** Every new task branches from an up-to-date `main`, never from another feature branch.
- **Merge PRs immediately.** Do not wait for all tasks to finish — merge each PR as soon as its task is complete.

---

## Mandatory Checks

Before considering any task complete, verify:

- [ ] Code follows the relevant prompt conventions (architecture, API, UI)
- [ ] Tests are written and passing (`pnpm --filter <package> test` for affected packages)
- [ ] Security tests exist for every new endpoint (401 + 403)
- [ ] No `console.log` in production code — use structured logger
- [ ] No hardcoded colors — use semantic tokens
- [ ] No raw HTML form elements — use `Form*` wrappers from `@packages/ui`
- [ ] No database access outside the owning module's service layer
- [ ] No side effects in domain services — emit events instead
- [ ] Lint passes

---

## What NOT to Do

- **Don't create new packages without discussing.** Most things belong in existing modules/packages.
- **Don't skip tests.** Code + tests are one unit. "I'll add tests later" is not acceptable.
- **Don't write code without reading existing code first.** Understand the codebase before modifying it.
- **Don't make large, monolithic changes.** Break into atomic tasks and commit each one.
- **Don't guess at architecture decisions.** If unsure, ask. Reference the prompts.
- **Don't add dependencies without justification.** Check if the need is already covered by the existing stack.
- **Don't deviate from the data handling rules.** Dates, currency, phone numbers, emails, passwords, percentages, and timezones all have specific storage/display rules defined in the prompts.
- **Don't modify packages to add domain-specific logic.** Packages (`packages/*`) must remain domain-agnostic. Never add entity-specific fields, types, or behavior to a package. If a feature requires domain-specific changes (e.g., adding `firstName`/`lastName` to a registration form), build it in the domain module (`apps/*/src/modules/`), not in the package. If the boundary is unclear, **always present options to the user and ask** — do not decide unilaterally.
- **Don't make architectural decisions without asking.** When a task crosses module/package boundaries, introduces new patterns, or could be implemented multiple ways, always present the options with trade-offs and let the user decide. Never silently pick an approach that affects the architecture.
