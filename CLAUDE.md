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
- **Custom fields storage** — dynamic custom fields per entity. JSONB (default) via `customFields: true` (table must spread `...customFieldsColumn()`); legacy EAV via `customFields: 'eav'`.
- **Layout system** — DB-driven form sections, field ordering, column layout — admin-editable
- **Workflow engine** — state machines with transitions, guards, conditions, multi-pipeline support
- **RBAC** — role-based permissions with field-level granularity, auto-registered per entity
- **Audit logging** — event-driven, with before/after snapshots, sensitive field redaction
- **Settings system** — typed per-module config with DB overrides, cached + invalidated via events

**Platform services (built):**
- **Taxonomy** — polymorphic tags + hierarchical categories, attachable to any entity
- **Notifications** — templates, dispatcher, channel providers, user preferences
- **Automations** — rule-based actions triggered by domain events or schedules. Pluggable action handlers, condition builder, user resolution strategies, provenance tracking, lifecycle bindings. **Action handler ownership pattern:** each package registers its own actions in `onModuleInit()` via `ActionRegistry` — `SendNotificationAction` in notifications, `WebhookAction` in automations, `CreateEntityAction`/`UpdateEntityAction` in entity-engine, `TransitionWorkflowAction` in workflows. Frontend UI: `platform-ui/automations/`.
- **Media management** — upload, storage abstraction (local/S3), attachments on any entity
- **Job queue** — background processing via Bull/BullMQ on Redis
- **Event system** — domain events with correlation IDs, side-effect handlers

**Form rendering system (built):**
The platform has a fully built, registry-driven form rendering system. **Never build custom form inputs for entity fields — use the existing system.**

- **Field type registries** — Two registries, populated at app startup:
  - Core registry (`packages/platform/field-types/registry.ts`) — storage strategy, validation, filter operators. No UI concerns.
  - UI registry (`packages/platform/field-types/ui/ui-registry.ts`) — `FormComponent`, `ViewComponent`, `CellFormatter`, `zodSchema` per field type.
- **`DynamicField`** (`packages/platform/eav-attributes-ui/components/DynamicField.tsx`) — renders the correct form component for any field type based on UI registry lookup. Must be inside a `FormProvider` (React Hook Form).
- **`buildFormSchema`** (`packages/platform/eav-attributes-ui/helpers/buildFormSchema.ts`) — dynamically builds a Zod validation schema from `FieldDefinition[]`.
- **`useEntityLayout`** (`packages/platform/entity-engine-ui/helpers/useEntityLayout.ts`) — fetches layout (sections + `FieldDefinition[]` with picklist options, lookup entities, etc.) for any entity type via `GET /layouts/{entityType}`.
- **Usage pattern** (see `EntityQuickCreateForm`, `EntityCreatePage`):
  1. Fetch layout via `useEntityLayout(entityType)`
  2. Build Zod schema via `buildFormSchema(fields)`
  3. Create form via `useForm({ resolver: zodResolver(schema) })`
  4. Wrap in `<FormProvider>`, render `<DynamicField>` per field
- **23+ field types** registered: text, email, phone, url, textarea, rich_text, number, currency, decimal, date, datetime, boolean, picklist, multi_select, lookup, multi_lookup, user, multi_user, auto_number, tags, file, category, workflow. Each has a dedicated form component (picklist → combobox, lookup → async search select, tags → chip input, etc.).

**Remaining work:**
- **Admin UIs** — visual builders for field management, layout customization, workflow editor
- **Dynamic navigation** — sidebar driven by entity registration + permissions (registry exists, UI needed)
- **Multi-tenancy enforcement** — framework designed, not fully implemented

### Package Tiers

Packages are organized into three tiers under `packages/`:

```
packages/
  core/       — Required by every app. Infrastructure + auth + base UI.
  platform/   — Standard platform features. Depends only on core.
  addons/     — Optional packages. Depend on core + optionally platform, never on other addons.
```

**`packages/core/`** (13 packages): common, database, logger, events, queue, query-builder, auth-core, rbac, auth, users, audit, settings, ui

**`packages/platform/`** (13 packages): entity-engine, entity-layout, field-types, automations, workflows, notifications, notification-channels, taxonomy, hierarchy, media, platform-ui, entity-engine-ui, eav-attributes-ui

**`packages/addons/`** (20 packages): eav-attributes, entity-relations, evaluations, tenancy, service-auth, oauth, orders-billing, orders-subscriptions, org-units, tasks, attachments, notes, drafts, document-templates, pdf-generator, and their UI counterparts

**Dependency rules:**
- Core packages may depend on other core packages only
- Platform packages may depend on core + other platform packages
- Addon packages may depend on core + platform, **never on other addons**
- All packages use `@packages/*` scope regardless of tier (single namespace)
- Package names do NOT encode the tier — the folder structure is the tier indicator

When creating a new package, place it in the correct tier based on these rules. If unsure, ask.

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
- **Don't modify packages to add domain-specific logic.** Packages (`packages/*`) must remain domain-agnostic. Never add entity-specific fields, types, or behavior to a package. If a feature requires domain-specific changes (e.g., adding `firstName`/`lastName` to a registration form), build it in the domain module (`apps/*/src/modules/`), not in the package. If the boundary is unclear, **always present options to the user and ask** — do not decide unilaterally.
- **Don't add new plumbing or abstractions to platform/core packages without solid reasoning.** `packages/core/*` and `packages/platform/*` are the substrate every app depends on; new mechanisms there (config fields, lifecycle hooks, registries, generic primitives) compound across all consumers — they're load-bearing forever, even when one consumer's need disappears. **Default to extending via services in `domains/*` or `apps/*`** — composition through public service APIs, not new fields/hooks/registries in the platform. If you find yourself wanting a new `EntityConfig` field, a new lifecycle hook, or a new registry to make a domain task work, that's the signal to either (a) solve it via service-level composition, or (b) propose the platform change explicitly with a written justification (cross-domain demand, no service-level path, demonstrable cost of not having it). Never add platform plumbing as a drive-by, and don't add it on the strength of a single consumer. Same as the `@Global()` rule below: reach for service composition first; new platform surface is the last resort.
- **Don't use event listeners as a code-execution path.** Event listeners are for **side effects only** — audit logs, notifications, observability, analytics, queueing unreliable I/O. When one module needs to mutate another module's state in response to an action (clearing FK references, cascading deletes, invariant maintenance), use direct service calls or subclass-based composition (e.g. an app's `UsersService` subclass overriding `softDelete()` to clear dependent references in the same transaction). Events run after commit with no rollback, so using them for state mutation creates windows of inconsistency and silent failure. Reaching for an event listener to execute code is allowed only in genuinely exceptional cases with a documented solid reason — never as the default. If unsure, ask.
- **Don't decorate modules with `@Global()` to make wiring convenient.** Globals hide dependencies, complicate test isolation, fragment refactors, and silently break consumers when extracted later (PR #1109 fixed exactly this regression). The default for every new addon, feature module, or app-level utility module is no `@Global` — consumers declare `imports: [...]` explicitly, and modules with cross-cutting per-app config use `forRoot({ imports, ... })`. `@Global` is reserved for kernel-tier infrastructure where the alternative is dozens or hundreds of explicit imports for a service that genuinely every module uses (`DatabaseModule`, `EventsModule`, `RbacModule`, `SettingsModule`, `AuditModule`, `NotificationsModule`, `EntityCoreModule`). Entity-engine extension providers (`AUTOMATIONS_EXTENSION`, `WORKFLOW_EXTENSION`, `EAV_STORAGE_EXTENSION`, `MULTI_VALUE_EXTENSION`, `LAYOUT_EXTENSION`) currently rely on `@Global` because the per-entity factory injects them via tokens; that's a known architectural debt to migrate to a registry pattern, not a license to add new globals. If you find yourself reaching for `@Global` to fix a DI error, stop — the right fix is almost always an explicit `imports: [...]` or a `forRoot` argument. If you genuinely believe a new global is justified, present the case to the user and wait for approval.
- **Don't make architectural decisions without asking.** See the CRITICAL rule at the top of this file.
