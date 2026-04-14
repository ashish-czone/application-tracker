# Compliance Domain — Resume Plan

**Branches:**
- `feat/entity-hierarchy` — PR 2a, platform prerequisite
- `feat/compliance-service` — PR 2b, waits on 2a (this worktree)

**Worktrees:**
- `.claude/worktrees/entity-hierarchy` — PR 2a
- `.claude/worktrees/compliance-service` — PR 2b (this one)

**Status:** planning complete, decisions locked after hierarchy refactor. Zero code written in either PR.

## What we're building

A compliance domain for tax professionals: clients registered under laws (GST, Income Tax, Audit, etc.) file returns on recurring schedules. Rules define the cadence, the system auto-generates filing tasks for a 6-month horizon, and tasks are assigned to org-units configured to handle each law.

## Architectural decisions (locked)

### Deployment topology
- **One codebase (`apps/recruit`), two Node processes.**
- Processes distinguished at runtime by `APP_DOMAIN` env var (`recruit` or `compliance`). No default — unset throws at bootstrap.
- Each process reads its own `DATABASE_URL` and points at its own Postgres.
- `app.module.ts` conditionally imports `recruitBackend.module` or `complianceBackend.module` based on `APP_DOMAIN`.
- All shared packages (`@packages/*`) load independently in each process — `@Global()` singletons are fine because each process has its own memory.
- **No `apps/compliance`.** We explicitly rejected a second app directory.

### Laws = hierarchical entity, NOT taxonomy categories
- Laws is a first-class entity in the compliance domain, defined via `defineEntity({ entityType: 'laws', hierarchy: true, fields: {...} })`.
- Typed columns: `name`, `code` (unique, e.g. "GST", "CGST"), `issuingAuthority`, `jurisdiction` (picklist), `effectiveFrom` (date), plus `parentId` (auto-added by the hierarchy flag).
- Uses the `defineEntity({ hierarchy: true })` flag shipped by PR 2a. The flag makes the entity engine validate the table spreads `hierarchyColumns()`, inject `HierarchyService`, auto-add the `parentId` lookup field, and expose `reparent`/`getAncestors`/`getDescendants` on the generated service.
- **Rationale:** taxonomy categories bring hierarchy + polymorphic attachment. Laws only need hierarchy + typed custom fields. Extracting "hierarchy" as a platform primitive is the right abstraction — any future tree-shaped entity (chart of accounts, org structures, product catalogs, geographies) reuses it.

### Database
- Compliance's DB holds every table the platform creates — each process boots its own copy of every shared module, and each shared module writes to its own configured DB.
- **Migrations live in a shared folder** `apps/recruit/drizzle/` for now. Both DBs run the same migration set. Compliance's DB ends up with recruit-specific tables unused and vice versa. **Tech debt, accepted.** Split later if it becomes a problem.
- New compliance tables, all in the same shared migration folder:
  - `compliance_laws` — includes `...hierarchyColumns(self)`, plus typed columns (`code`, `issuing_authority`, `jurisdiction`, `effective_from`, `description`).
  - `compliance_clients` — compliance's own client table, separate from recruit's clients. No shared client primitive.
  - `compliance_rules` — `{name, law_id uuid FK, frequency, due_day_of_month, due_month_offset, grace_period_days, description, active}`. Frequency enum: `monthly | quarterly | half_yearly | yearly`.
  - `compliance_law_handlers` — pivot `{law_id uuid FK, org_entity_id uuid FK, is_primary bool, client_id uuid nullable FK}`. Client-specific override when `client_id` is set; global default when NULL. Unique index on `(law_id, org_entity_id, client_id)`.
  - `compliance_client_laws` — pivot `{client_id uuid FK, law_id uuid FK, registered_at, deactivated_at nullable}`. Unique `(client_id, law_id) WHERE deactivated_at IS NULL`.

### Shared tasks table — new column (lands in PR 2b)
- `packages/addons/tasks` gains `external_key text` (nullable).
- Partial unique index: `(related_entity_type, related_entity_id, external_key) WHERE external_key IS NOT NULL`.
- The column is a domain-agnostic primitive — any recurring generator (subscriptions, renewals, recurring billing) can reuse it. Migration lands in PR 2b for convenience, not because it's compliance-specific.

### Task generation
- **Uses the shared `@packages/tasks` table** in compliance's DB (PR 1 extended it with polymorphic `related_entity_type` / `related_entity_id`; PR 2b adds `external_key`).
- **Strategy:** one scheduled automation runs daily; a custom `GenerateComplianceTasksAction` registered by the compliance domain expands all active rules into task occurrences.
- **Window:** any occurrence with `dueDate ≤ now + 6 months` gets a task.
- **Period definition:** the reporting window being filed for, NOT the filing deadline.
  - Quarterly GST (due 11th of month after quarter-end): Q1 2026 → `periodStart=2026-01-01`, `periodEnd=2026-03-31`, `dueDate=2026-04-11`
  - Monthly GST (due 20th of next month): April 2026 → `periodStart=2026-04-01`, `periodEnd=2026-04-30`, `dueDate=2026-05-20`
  - Yearly income tax (Indian FY, due Jul 31): FY 2026-27 → `periodStart=2026-04-01`, `periodEnd=2027-03-31`, `dueDate=2027-07-31`
- **Occurrence shape:** `{ periodStart: Date, periodEnd: Date, dueDate: Date }` returned by `expandRule(rule, from, to)`.
- **Idempotency key:** `external_key = ${ruleId}:${clientId}:${periodStart.toISOString().slice(0,10)}`. Example: `a1b2c3d4-...:f9e8d7c6-...:2026-01-01`. PeriodStart is invariant — rule edits to `due_day_of_month` or `grace_period_days` don't change which periods exist, only the dueDate of future-generated tasks. Existing tasks keep their original dueDate. Explicit "Rebuild future schedule" UX is deferred.
- **Task title** renders the period as a human string (e.g. "GST Return — Q1 2026"). Title is cosmetic; dedupe lives on `external_key`.
- **Assignee resolution (strict, no fallback-to-unassigned):**
  1. Client-specific primary (`client_id = X AND is_primary = true`)
  2. Client-specific any (`client_id = X`) — error if >1
  3. Global primary (`client_id = NULL AND is_primary = true`)
  4. Global any (`client_id = NULL`) — error if >1
- **Rule creation guard:** `ComplianceRuleService.create` calls `LawHandlerService.hasDefaultHandler(rule.lawId)` and throws `BadRequestException { code: 'NO_DEFAULT_HANDLER' }` if false. UI catches this error and opens an inline dialog to create the handler before retrying.

### Task workflow (inherited from PR 1, already merged)
- States: `pending → in_progress → review → completed` + `cancelled` off-path terminal.
- Permissions: `tasks.submitForReview`, `tasks.approveReview`, plus existing `tasks.assign`, `tasks.complete`, `tasks.cancel`, `tasks.reopen`.
- Compliance tasks default to `pending` on create.

## Frontend
- **Out of scope for PR 2b.** Backend-only.
- Future PR: frontend strategy TBD.

---

## PR 2a task list — `feat/entity-hierarchy` (prerequisite)

All tasks on the `feat/entity-hierarchy` branch in the `entity-hierarchy` worktree. Must merge before PR 2b can start.

| # | Task | Notes |
|---|---|---|
| 1 | **Entity-engine `hierarchy: true` flag** | Accept the flag in `defineEntity`, validate the table spreads `hierarchyColumns()` at registration (fail fast with a clear error), inject `HierarchyService` into the generated entity service. Unit tests for flag parsing + validation errors. |
| 2 | **Generated service methods + auto parentId field** | `reparent(id, newParentId)`, `getAncestors(id)`, `getDescendants(id)` on the entity service, delegating to `HierarchyService`. `beforeCreate` computes `path`/`depth` via `HierarchyService.computeInsertValues`. `parentId` field auto-added to the entity's field registry as a lookup into the same entity. Unit tests. |
| 3 | **Controller routes** | `POST /:type/:id/reparent`, `GET /:type/:id/ancestors`, `GET /:type/:id/descendants`. Integration + 401/403 security tests. |
| 4 | **`packages/platform/hierarchies-ui` package** | New platform package. Scaffold + `<HierarchyTable>` built on entity-engine-ui list-view infra. Indent rows by `depth`, expand/collapse per subtree, drag-to-reparent calling the reparent endpoint. Component tests for rendering + drag. |
| 5 | **Pre-merge checks + PR** | Affected package unit tests, `pnpm --filter @apps/recruit build`, `pnpm --filter @apps/recruit-web build`, `pnpm lint`. Push, PR, merge, exit worktree, pull main. |

---

## PR 2b task list — `feat/compliance-service`

Runs after PR 2a merges. Rebase the existing `feat/compliance-service` branch onto the updated `main` before starting (current branch has only the resume-plan doc commits).

| # | Task | Notes |
|---|---|---|
| 1 | **Scaffold `domains/compliance/api/`** | package.json, index.ts (manifest), empty `ComplianceDomainModule`, vitest config. Package compiles with zero contents. |
| 2 | **Wire conditional domain loading** | `apps/recruit/src/app.module.ts` picks `recruitBackend.module` or `complianceBackend.module` from `APP_DOMAIN`. Add `APP_DOMAIN` to `env.validation.ts` (required, `IsIn(['recruit','compliance'])`, no default). Add `@domains/compliance-api` as workspace dep + tsconfig path mapping. Update `.env.example`. Verify both `APP_DOMAIN` values build cleanly. |
| 3 | **Schema + migrations** | Drizzle schema files in `domains/compliance/api/schema/`. Hand-authored SQL migration in `apps/recruit/drizzle/` covering five tables (`compliance_laws` with `hierarchyColumns()`, `compliance_clients`, `compliance_rules`, `compliance_law_handlers`, `compliance_client_laws`). Same or separate migration adding `external_key` column + partial unique index to the shared `tasks` table. Update `_journal.json`. |
| 4 | **Entity configs via `defineEntity`** | `LAWS_CONFIG` with `hierarchy: true`, `CLIENTS_CONFIG` (entityType `'clients'`), `COMPLIANCE_RULES_CONFIG`, `LAW_HANDLERS_CONFIG`. Wired into `ComplianceDomainModule` via `EntityEngineModule.forEntity`. Nav group `'compliance'`. Template: `domains/recruit/api/clients/clients.config.ts`. |
| 5 | **`LawHandlerService`** | CRUD + `hasDefaultHandler(lawId)`. Pure unit tests with mocked DB. |
| 6 | **`ClientLawService`** | Register/deregister a client for a law. `getRegisteredClients(lawId)` (all active registrations). `getRegisteredLaws(clientId)`. Unit tests. |
| 7 | **`ComplianceRuleService`** | CRUD with `beforeCreate` handler guard. `expandRule(rule, from, to) → Occurrence[]` supporting monthly/quarterly/half_yearly/yearly (returns `{periodStart, periodEnd, dueDate}`). `resolveAssignee(lawId, clientId)` with strict 4-tier lookup and `AMBIGUOUS_HANDLER` error. Unit tests covering each frequency, edge cases (year/month boundary, Feb leap year, yearly with Indian FY starting April), each assignee tier, ambiguity error. |
| 8 | **`GenerateComplianceTasksAction`** | Registered via `ActionRegistry.register()` in `onModuleInit()`. For each `(active rule × client registered for that rule's law)` from `ClientLawService`: expand to 6-month window, for each occurrence compute `externalKey = ${ruleId}:${clientId}:${periodStart}`, idempotency check via `tasksService.findByExternalKey`, resolve assignee, create task via shared `@packages/tasks` EntityService with `{title, dueDate, assigneeId, relatedEntityType='compliance_rule', relatedEntityId=ruleId, externalKey}`. Emits `COMPLIANCE_TASK_GENERATED` per created task. Unit tests: no-rules, no-clients, ambiguity error path, idempotency (second run = 0 creates), correct dueDate per frequency, period-start invariance on rule dueDate edits. |
| 9 | **Seed daily scheduled automation** | On module init, seed one automation with slug `compliance-generate-tasks-daily`, cron via `cronForLocalHour`, wired to the action. Idempotent by slug. Admin-editable afterwards. |
| 10 | **Pre-merge checks + PR** | `pnpm --filter @domains/compliance-api test`, `pnpm --filter @packages/tasks test`, `pnpm --filter @apps/recruit build` twice (`APP_DOMAIN=recruit` and `APP_DOMAIN=compliance`), `pnpm lint`. Push, PR, merge, exit worktree, pull main. |

## Known gotchas

- **`apps/recruit/drizzle.config.ts` has stale schema paths** — don't run `drizzle-kit generate`. Write migrations by hand.
- **`validatePayload` rejects unknown fields** — every column written via the entity service must be declared in the entity config's `fields` block.
- **`external_key` on tasks** is set by `GenerateComplianceTasksAction` via the shared tasks EntityService. Verify the task entity config exposes `externalKey` as a writable field, or the action bypasses field validation via a lower-level service method.
- **`TASKS_CONFIG.fieldMeta`** has the polymorphic fields from PR 1. Compliance's DB has those columns because the shared migration set includes PR 1's migration.
- **EntityEngine auto-routes** each registered entity to `GET/POST/PATCH/DELETE /entityType`. Compliance's `clients` entity at `/api/v1/clients` in compliance's process is fine — recruit's `/api/v1/clients` lives in a different process at a different port.
- **No new app package** — do not create `apps/compliance/`. Same codebase, conditional module load.
- **`cronForLocalHour`** lives in `@packages/common`. Use it for any cron scheduling; never hardcode UTC cron expressions.
- **`hierarchyColumns(selfRef)`** takes the self-referencing table as a parameter to wire `ON DELETE CASCADE` on `parent_id`. Pass the laws table reference.

## Resume checklist

### If resuming PR 2a
1. `cd .claude/worktrees/entity-hierarchy`
2. `git status` — verify on `feat/entity-hierarchy`
3. `git log --oneline origin/main..HEAD` — check which tasks are already committed
4. Continue from the next task in the PR 2a list above

### If resuming PR 2b (requires PR 2a merged to main)
1. `cd .claude/worktrees/compliance-service`
2. If PR 2a has landed and this branch is stale: `git fetch origin main && git reset --hard origin/main` (the only commits so far are planning docs, safe to discard), then `git checkout -b feat/compliance-service origin/main` if the branch was deleted upstream
3. Continue from the next task in the PR 2b list above

## Reference: PR 1 (already merged)

`feat(tasks): polymorphic related entity + review workflow state` — PR #765
- Added `related_entity_type`, `related_entity_id` columns + composite index to `tasks`
- Renamed workflow: `open→pending`, `done→completed`, added `review` state, kept `cancelled`
- Added `tasks.submitForReview` + `tasks.approveReview` permissions
- 13 unit tests in `packages/addons/tasks/api/__tests__/tasks.config.unit.test.ts`
