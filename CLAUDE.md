# Claude Code — Project Instructions

This file is read automatically at the start of every conversation. It defines how you work within this codebase.

---

## CRITICAL: Never Make Architectural Decisions Automatically

**This is the single most important rule.** When multiple approaches exist for implementing something — especially when it involves:
- Bypassing established service layers or patterns
- Crossing package/module boundaries
- Introducing a new pattern that doesn't already exist in the codebase
- Choosing between "quick hack" and "proper implementation"

**STOP. Present the options with trade-offs. Ask the user explicitly. Wait for their answer before writing any code.**

Never default to the simplest/easiest approach. Never decide unilaterally. Even if one option seems obviously better, explain the trade-offs and let the user choose. This is a platform codebase — architectural consistency matters more than speed.

---

## Project Vision

This is a **domain-agnostic, configuration-based app builder** for developers. It enables rapid application development — ERPs, CRMs, marketplaces, HR systems, project management tools — where ~80% of requirements are met through core platform capabilities and configuration, and ~20% through customization hooks.

**How it works:**
- **Define entities declaratively** — `defineEntity()` takes a model definition (fields, relationships, workflows, permissions, layout, UI hints) and generates everything: CRUD API, validation, RBAC, events, audit logging, search, filtering, pagination.
- **Customize with hooks** — Lifecycle hooks (`beforeCreate`, `afterCreate`, `beforeUpdate`, `buildListFilters`, `workflowGuards`, etc.) let developers inject domain-specific logic without touching the engine.
- **Extend with field types** — The pluggable field type registry supports 23+ built-in types. New types can be added without modifying core.
- **Configure at runtime** — Layouts, field visibility, workflow states, notification rules, and settings are all DB-driven and admin-editable.

**Core principles:**
- **Configuration over code** — if something can be expressed as config, it should be. Code is for the exceptional cases.
- **Domain agnosticism** — the platform has zero knowledge of "candidates", "orders", or any business entity. Packages must never reference domain concepts.
- **Hookable, not forkable** — customization happens through well-defined extension points, not by modifying platform code.
- **Enterprise-grade** — audit logging, RBAC with field-level permissions, event-driven side effects, multi-tenancy readiness.

Every architectural decision should ask: "Does this keep the platform domain-agnostic? Could a developer building a CRM use this the same way as one building an ERP?" If the answer is no, the approach is too narrow.

### Platform Capabilities

**Core engine (built):**
- **Entity engine** — `defineEntity()` API, generic CRUD service, auto-generated controllers
- **Field type system** — pluggable registry with 23+ types (text, email, lookup, workflow, tags, file, etc.)
- **EAV storage** — dynamic custom fields per entity, opt-in via `customFields: true`
- **Layout system** — DB-driven form sections, field ordering, column layout — admin-editable
- **Workflow engine** — state machines with transitions, guards, conditions, multi-pipeline support
- **RBAC** — role-based permissions with field-level granularity, auto-registered per entity
- **Audit logging** — event-driven, with before/after snapshots, sensitive field redaction
- **Settings system** — typed per-module config with DB overrides, cached + invalidated via events

**Platform services (built):**
- **Taxonomy** — polymorphic tags + hierarchical categories, attachable to any entity
- **Notifications** — rule-based routing (event → channels → recipients), templates, user preferences
- **Media management** — upload, storage abstraction (local/S3), attachments on any entity
- **Job queue** — background processing via Bull/BullMQ on Redis
- **Event system** — domain events with correlation IDs, side-effect handlers

**Remaining work:**
- **Admin UIs** — visual builders for field management, layout customization, workflow editor, notification rules
- **Dynamic navigation** — sidebar driven by entity registration + permissions (registry exists, UI needed)
- **Multi-tenancy enforcement** — framework designed, not fully implemented
- **Form renderer** — schema-driven forms that render entirely from layout + field definition metadata

---

## Project Prompts

This project has architectural and coding prompts as deep-reference docs. The most critical rules are extracted into `.claude/rules/` (auto-loaded every conversation), so you do NOT need to read PROMPT files for routine changes.

**Read PROMPT files when:**
- Building a new module or package from scratch
- Working on unfamiliar patterns (e.g., first time writing E2E tests, first infra change)
- Unsure about a convention that isn't covered by the auto-loaded rules

**Skip PROMPT files when:**
- Making routine changes to existing code (the existing code + auto-loaded rules are sufficient)
- The rules files cover the relevant conventions

| Task type | Read if unfamiliar |
|---|---|
| Backend module/feature | PROMPT.md, PROMPT-API.md, PROMPT-TESTING.md |
| Frontend feature | PROMPT.md, PROMPT-UI.md, PROMPT-TESTING.md |
| Full-stack feature | PROMPT.md, PROMPT-API.md, PROMPT-UI.md, PROMPT-TESTING.md |
| Infrastructure/deployment | PROMPT-INFRA.md |
| Auth changes | PROMPT-AUTH.md |

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

# All package unit tests (no DB required)
npx turbo run test --filter='@packages/*'
```

If any test fails, fix the issue before committing. Do not skip failing tests.

**After each task is done, immediately create a PR and merge it.** Do not accumulate multiple tasks on one branch. Each task gets its own branch, its own PR, and is merged before starting the next task.

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
| 1. Schema | Drizzle schema + migration | — |
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
4. Merge the PR to `main` immediately after creation.
5. Switch back to `main` and pull before starting the next task.

### Rules

- **Never commit directly to `main`.** Always use a feature branch.
- **Never force-push** unless explicitly asked.
- **Never amend a commit** unless explicitly asked. Create new commits.
- **Code and tests are committed together** — never commit code in one commit and its tests in another.
- **Always start from `main`.** Every new task branches from an up-to-date `main`, never from another feature branch.
- **Merge PRs immediately after creation.** Do not wait for manual approval — tests must pass before committing, and the PR is the review record.

---

## Mandatory Checks

Before considering any task complete, verify:

- [ ] Code follows the relevant prompt conventions (architecture, API, UI)
- [ ] Tests are written and passing (`pnpm --filter <package> test` for affected packages)
- [ ] Security tests exist for every new endpoint (401 + 403)
- [ ] No `console.log` in production code — use structured logger
- [ ] No hardcoded colors — use semantic tokens
- [ ] No raw HTML form elements — use `Form*` wrappers from `@packages/ui/components/form/`
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
- **Don't make architectural decisions without asking.** See the CRITICAL rule at the top of this file.
