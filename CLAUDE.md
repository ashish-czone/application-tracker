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

This is a **modular library stack** for building enterprise TypeScript apps. It is **not** a framework that generates apps from configuration — it is a layered set of libraries that apps compose explicitly.

**The four layers, in dependency order:**

1. **Core** (`packages/core/` + `packages/platform/`) — the foundation: cross-cutting infrastructure every app depends on. Database, events, queue, audit, rbac, settings, auth, users, UI primitives, app-shell. Narrow, stable APIs. No domain knowledge. (`core/` and `platform/` are two folders for the same conceptual tier — see Package Tiers below.)
2. **Addons** (`packages/addons/`) — opt-in capabilities that extend the foundation: entity-engine, entity-layout, field-types, workflows, automations, hierarchy, taxonomy, notifications, media, evaluations, tasks, attachments, oauth, tenancy, etc. Apps and domains import only the addons they actually use.
3. **Domains** (`domains/`) — self-contained business verticals (recruit, compliance, agency, etc.). Each domain owns its entities, services, and UI components. May depend on core + addons. **Never depends on another domain** — shared concepts graduate into addons.
4. **Apps** (`apps/`) — user-facing products that compose one or more domains, add app-specific entities/screens, and ship as deployable units.

**Dependency direction:** `apps → domains → addons → core`. Addons may depend on other addons (acyclic). Domains never depend on other domains. Apps may depend on multiple domains.

**Design principles:**
- **Library, not framework.** Public APIs are services and types you import and call. No magic config that generates code at startup. The library does not own the app's lifecycle — apps stay in control of their NestJS modules and React routes.
- **Narrow, high-leverage core.** Cross-cutting concerns (rbac, events, audit, notifications, settings) are abstracted *away* — adding RBAC to a controller is a decorator, emitting an event is one line. The cost of using core stays small so domains don't accumulate framework tax.
- **Opt-in addons.** Capabilities like entity-engine, workflows, automations are addons — apps that don't need them don't pay for them. `defineEntity()`-style generic CRUD is one optional way to build an entity, not the central platform contract. Hand-written services + controllers are equally first-class.
- **Domain isolation.** A domain can be lifted into a different app without dragging another domain with it. Cross-domain wiring lives at the app layer (`apps/<app>/cross-domain/`), never inside a domain.
- **Composition over configuration.** When a domain needs to react to another module's event, override a service method, or extend behaviour — it does so by importing the relevant service and calling it (or subclassing it). Hooks and registries exist only where cross-cutting demand is proven.

**What this is not:** not a no-code or low-code platform, not a lifecycle-owning framework, not config-driven by default. Apps are real TypeScript codebases that compose libraries.

Every architectural decision should ask: "Does this keep the foundation narrow and the addons opt-in? Could a domain or app skip this capability entirely without re-wiring the world?" If the answer is no, the abstraction is too eager.

### Package Tiers

Packages are organized into two tiers under `packages/`. Today the foundation tier is split across two folders for historical reasons (`core/` and `platform/`); conceptually they are one tier — both contain foundation infrastructure that domains and addons depend on.

```
packages/
  core/       — Foundation (subset 1): pure infra primitives with no NestJS surface
                — common, database, events, logger, query-builder, soft-delete,
                  ui, debug-profiler, testing
  platform/   — Foundation (subset 2): the rest of the foundation, including
                NestJS-bound infra (rbac, audit, auth, settings, queue,
                notifications, users, app-shell, theming-ui, etc.) and a few
                cross-cutting UI shells (platform-ui, dashboard-ui)
  addons/     — Opt-in capabilities. May depend on core + platform + other addons.
                Apps import only what they use.
```

**Dependency rules:**
- `core/` and `platform/` packages depend only on other foundation (`core/` + `platform/`) packages — never on `addons/`.
- Addon packages may depend on foundation + other addons. Acyclic, no addon → addon cycles.
- `domains/*` may depend on foundation + addons. Never on other domains.
- `apps/*` may depend on foundation + addons + one or more domains.
- All packages use the `@packages/*` scope regardless of folder. Package names do NOT encode the tier — the folder structure is the tier indicator.

**Documented exceptions** to "foundation never imports addons":
- `packages/platform/app-shell` — the runtime integrator that wires every module (core + platform + addon + domain) into a runnable Nest/React app. It is allowed to import addons.
- `packages/platform/testing` — the test integrator (`createPlatformTestModule` / `createTestApp`) that bootstraps a test app with relevant addons wired in.

No other foundation package may import from addons.

**On the `core/` vs `platform/` split:** the only meaningful distinction today is "framework-free primitives" (`core/`) vs "NestJS-aware infra" (`platform/`). Over time, packages may move between the two folders as their dependencies evolve, or the split may be flattened — but the *vision* is one foundation tier, not two. When creating a new foundation package, place it in `core/` if it has no NestJS surface and no UI shell, otherwise in `platform/`. If unsure, ask.

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

### Step 2: Implement → Test → Commit (per task)

Work through tasks one at a time, in order. For each task:

```
Implement → Write tests → Run tests → Fix if failing → Commit
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

**Each task = one commit.** Commit immediately when tests pass, then continue to the next task on the same branch.

### Step 2b: Push → PR → Merge (after all tasks in the flow)

After all tasks in the feature flow are complete:

1. Push the branch.
2. Create a single PR that covers the entire feature.
3. Merge the PR to `main`.

**When to create intermediate PRs instead:** If a feature has tasks that cross package boundaries and later tasks depend on earlier ones being importable by other packages (e.g., Task 1 adds types to Package A, Task 5 imports them in Package B), you may batch related tasks into intermediate PRs. Use judgment — the goal is to minimize PR/merge ceremony while keeping each commit independently reviewable. A 12-task feature in a single new package should be 1 PR. A 12-task feature touching 6 packages may need 2–3 PRs at natural seams.

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

Break features into these standard tasks. Skip tasks that don't apply. Each task = one commit. Never combine multiple tasks into one commit.

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

One PR per feature flow (not per task). Created after all tasks are complete:

1. Push the branch: `git push -u origin feat/add-candidate-submission`
2. Create PR with a summary of the full feature — list all tasks/commits included.
3. PR title follows the same conventional format: `feat: add candidate submission`
4. Merge the PR to `main` immediately after creation.
5. Switch back to `main` and pull.

### Rules

- **Never commit directly to `main`.** Always use a feature branch.
- **Never force-push** unless explicitly asked.
- **Never amend a commit** unless explicitly asked. Create new commits.
- **Code and tests are committed together** — never commit code in one commit and its tests in another.
- **Always start from `main`.** Every new feature branches from an up-to-date `main`, never from another feature branch.
- **Merge PRs immediately after creation.** Do not wait for manual approval — tests must pass before committing, and the PR is the review record.
- **One commit per task, one PR per feature.** Tasks are atomic commits. The PR groups all tasks in a feature flow.

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
- **Don't fetch with `limit=1000` (or any high arbitrary cap), join multiple list endpoints client-side, or derive filter buckets in JavaScript.** Server-side filtering, sorting, pagination, and joining are mandatory — pattern matters more than current data volume, because the failure mode is silent truncation that no test or log will catch. "Works for now", "we don't have many X yet", and "we'll paginate later" are themselves violations. If the backend doesn't support the filter the screen needs, add the filter to the backend before wiring the UI. Full rule: `.claude/rules/data-fetching.md`.
- **Don't write a raw Drizzle query (`db.select/update/delete`) or `sql\`…\`` template without `withScope(table, …)` (or the equivalent inline predicates) in the WHERE.** Soft-delete and tenancy scope are caller-side responsibilities the moment you bypass `EntityService`. Forgetting them means tombstoned rows appear in dashboards, scoped users see firm-wide aggregates, and (with tenancy) cross-tenant rows leak. The same call site stays correct on a non-soft-delete, non-tenanted table — `withScope` is a runtime no-op there. Bypasses use `withScopeIncludingDeleted` (separate function, not a flag) with an inline-comment justification. Full rule: `.claude/rules/data-scoping.md`.
- **Don't modify packages to add domain-specific logic.** Packages (`packages/*`) must remain domain-agnostic. Never add entity-specific fields, types, or behavior to a package. If a feature requires domain-specific changes (e.g., adding `firstName`/`lastName` to a registration form), build it in the domain module (`apps/*/src/modules/`), not in the package. If the boundary is unclear, **always present options to the user and ask** — do not decide unilaterally.
- **Don't add new plumbing or abstractions to platform/core packages without solid reasoning.** `packages/core/*` and `packages/platform/*` are the substrate every app depends on; new mechanisms there (config fields, lifecycle hooks, registries, generic primitives) compound across all consumers — they're load-bearing forever, even when one consumer's need disappears. **Default to extending via services in `domains/*` or `apps/*`** — composition through public service APIs, not new fields/hooks/registries in the platform. If you find yourself wanting a new `EntityConfig` field, a new lifecycle hook, or a new registry to make a domain task work, that's the signal to either (a) solve it via service-level composition, or (b) propose the platform change explicitly with a written justification (cross-domain demand, no service-level path, demonstrable cost of not having it). Never add platform plumbing as a drive-by, and don't add it on the strength of a single consumer. Same as the `@Global()` rule below: reach for service composition first; new platform surface is the last resort.
- **Don't use event listeners as a code-execution path.** Event listeners are for **side effects only** — audit logs, notifications, observability, analytics, queueing unreliable I/O. When one module needs to mutate another module's state in response to an action (clearing FK references, cascading deletes, invariant maintenance), use direct service calls or subclass-based composition (e.g. an app's `UsersService` subclass overriding `softDelete()` to clear dependent references in the same transaction). Events run after commit with no rollback, so using them for state mutation creates windows of inconsistency and silent failure. Reaching for an event listener to execute code is allowed only in genuinely exceptional cases with a documented solid reason — never as the default. If unsure, ask.
- **Don't write to the database in `onModuleInit` (or any boot lifecycle hook).** `onModuleInit` is for in-memory registry registration only — permission slugs, audit-event metadata, code-defined workflow defs into `WorkflowRegistryService`, etc. Anything that issues `INSERT` / `UPDATE` / `DELETE` (including "seed if missing" idempotency loops) belongs in `apps/<app>/src/cli/seed.ts`, run from a controlled CLI invocation. Boot-time DB writes have undefined ordering w.r.t. migrations, race across multi-pod deployments, leak idempotency contracts into runtime, and force test harnesses to replay seeds after every truncate. Static config defined in code (workflow defs, permission manifests, event constants) is held in memory by the registry and is never seeded to the DB at all — when an FK to a code-resident def looks tempting, drop the FK rather than seeding the row. Full rule: `.claude/rules/init-vs-seed.md`.
- **Don't decorate modules with `@Global()` to make wiring convenient.** Globals hide dependencies, complicate test isolation, fragment refactors, and silently break consumers when extracted later (PR #1109 fixed exactly this regression). The default for every new addon, feature module, or app-level utility module is no `@Global` — consumers declare `imports: [...]` explicitly, and modules with cross-cutting per-app config use `forRoot({ imports, ... })`. `@Global` is reserved for kernel-tier infrastructure where the alternative is dozens or hundreds of explicit imports for a service that genuinely every module uses (`DatabaseModule`, `EventsModule`, `RbacModule`, `SettingsModule`, `AuditModule`, `NotificationsModule`, `EntityCoreModule`). Entity-engine extension providers (`AUTOMATIONS_EXTENSION`, `WORKFLOW_EXTENSION`, `EAV_STORAGE_EXTENSION`, `MULTI_VALUE_EXTENSION`, `LAYOUT_EXTENSION`) currently rely on `@Global` because the per-entity factory injects them via tokens; that's a known architectural debt to migrate to a registry pattern, not a license to add new globals. If you find yourself reaching for `@Global` to fix a DI error, stop — the right fix is almost always an explicit `imports: [...]` or a `forRoot` argument. If you genuinely believe a new global is justified, present the case to the user and wait for approval.
- **Don't make architectural decisions without asking.** See the CRITICAL rule at the top of this file.
