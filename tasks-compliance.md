# Compliance Domain — Resume Plan

**Branch:** `feat/compliance-service`
**Worktree:** `.claude/worktrees/compliance-service`
**Status:** planning complete, zero code written

## What we're building

A compliance domain for tax professionals: clients registered under laws (GST, Income Tax, Audit, etc.) file returns on recurring schedules. Rules define the cadence, the system auto-generates filing tasks six months in advance, and tasks are assigned to org-units configured to handle each law.

## Architectural decisions (locked)

### Deployment topology
- **One codebase (`apps/recruit`), two Node processes.**
- Processes are distinguished at runtime by `APP_DOMAIN` env var (`recruit` or `compliance`). No default — unset throws at bootstrap.
- Each process reads its own `DATABASE_URL` and points at its own Postgres.
- `app.module.ts` conditionally imports `recruitBackend.module` or `complianceBackend.module` based on `APP_DOMAIN`.
- All shared packages (`@packages/*`) load independently in each process — `@Global()` singletons are fine because each process has its own memory.
- **No `apps/compliance`.** We considered and rejected a second app directory.

### Why not other options (for posterity)
- **Single process, two domains, two DBs**: blocked by a 3–5 day platform refactor (22 `@Global()` modules, in-memory registries, `DatabaseModule` reading `process.env.DATABASE_URL` in constructor).
- **Shared DB with `compliance_*` prefixed tables**: rejected because we want physical data isolation and an extraction path.
- **Separate `apps/compliance` codebase**: rejected as unnecessary duplication — the shell is identical, only the domain module differs.

### Database
- Compliance's DB holds **every table** the platform creates, because each process boots its own copy of every shared module and each shared module writes to its own configured DB.
- **Migrations live in a shared folder** `apps/recruit/drizzle/` for now. Both DBs run the same migration set. Compliance's DB ends up with recruit-specific tables unused and vice versa. **Tech debt, accepted for PR 2.** Split later if it becomes a problem.
- New compliance tables (`compliance_clients`, `compliance_rules`, `compliance_law_handlers`) land as a new migration in the same shared folder.

### Domain model
- **Laws are categories** — use the existing `@packages/taxonomy` category tree. No first-class Law entity. Slugs like `law/gst`, `law/income-tax/tds`, `law/audit/statutory`.
- **`compliance_clients`** — compliance's own client table. Different entity from recruit's clients. No shared client primitive — we explicitly rejected `accounts` / `organizations` / shared Client extensibility.
- **`compliance_rules`** — `{name, lawCategorySlug, frequency, dueDayOfMonth, dueMonthOffset, gracePeriodDays, description, active}`. Frequency enum: `monthly | quarterly | half_yearly | yearly`.
- **`compliance_law_handlers`** — pivot `{lawCategorySlug, orgEntityId, isPrimary, clientId nullable}`. Client-specific override when `clientId` is set; global default when `clientId` is NULL. Unique index on `(lawCategorySlug, orgEntityId, clientId)`.

### Task generation
- **Uses the shared `@packages/tasks` table** in compliance's DB (which PR 1 already extended with `relatedEntityType` / `relatedEntityId` polymorphic columns).
- **Strategy:** one scheduled automation runs daily; a custom `GenerateComplianceTasksAction` registered by the compliance domain expands all active rules into task occurrences.
- **Window:** any occurrence with `dueDate ≤ now + 6 months` gets a task.
- **Idempotency:** deterministic external key `${ruleId}:${periodStart.toISOString()}`, existing tasks are skipped.
- **Assignee resolution (strict, no fallback-to-unassigned):**
  1. Client-specific primary (`clientId = X AND isPrimary = true`)
  2. Client-specific any (`clientId = X`) — error if >1
  3. Global primary (`clientId = NULL AND isPrimary = true`)
  4. Global any (`clientId = NULL`) — error if >1
- **Rule creation guard:** `ComplianceRuleService.create` calls `LawHandlerService.hasDefaultHandler(rule.lawCategorySlug)` and throws `BadRequestException { code: 'NO_DEFAULT_HANDLER' }` if false. UI catches this error and opens an inline dialog to create the handler before retrying the rule save.

### Task workflow (inherited from PR 1, already merged)
- States: `pending → in_progress → review → completed` + `cancelled` as off-path terminal.
- Permissions: `tasks.submitForReview`, `tasks.approveReview`, plus existing `tasks.assign`, `tasks.complete`, `tasks.cancel`, `tasks.reopen`.
- Compliance tasks default to `pending` on create; workflow transitions are the standard shared tasks workflow.

## Frontend
- **Out of scope for PR 2.** Backend-only.
- Future PR: decide whether `apps/recruit-web` aggregates both backends via env-configured URLs, or compliance gets its own SPA.

## Task list for PR 2

All tasks committed on `feat/compliance-service` branch. One commit per task. Tests pass before each commit. Pre-merge checks run once at the end.

| # | Task | Notes |
|---|---|---|
| 1 | **Scaffold `domains/compliance/api/`** | package.json, index.ts (manifest), empty `ComplianceDomainModule`, vitest config. Package compiles with zero contents. |
| 2 | **Wire conditional domain loading** | `apps/recruit/src/app.module.ts` picks `recruitBackend.module` or `complianceBackend.module` from `APP_DOMAIN`. Add `APP_DOMAIN` to `env.validation.ts` (required, `IsIn(['recruit','compliance'])`, no default). Add `@domains/compliance-api` as workspace dep. Add tsconfig path mapping. Update `.env.example`. Verify both `APP_DOMAIN` values build cleanly. |
| 3 | **Compliance schema + migration** | Drizzle schema files in `domains/compliance/api/`. Hand-authored SQL migration in `apps/recruit/drizzle/`, update `_journal.json`. Three tables: `compliance_clients`, `compliance_rules`, `compliance_law_handlers`. Indexes + FKs. |
| 4 | **Entity configs via `defineEntity`** | `CLIENTS_CONFIG` (entityType `'clients'`), `COMPLIANCE_RULES_CONFIG`, `LAW_HANDLERS_CONFIG`. Wired into `ComplianceDomainModule` via `EntityEngineModule.forEntity`. Template: `domains/recruit/api/clients/clients.config.ts`. Nav group `'compliance'`. |
| 5 | **`LawHandlerService`** | CRUD + `hasDefaultHandler(slug)`. Pure unit tests with mocked DB. |
| 6 | **`ComplianceRuleService`** | CRUD with `beforeCreate` handler guard. `expandRule(rule, from, to) → Occurrence[]` supporting monthly/quarterly/half_yearly/yearly. `resolveAssignee(slug, clientId)` with strict 4-tier lookup and `AMBIGUOUS_HANDLER` error. Unit tests covering each frequency, edge cases (year/month boundary, Feb leap year), each assignee tier, and ambiguity error. |
| 7 | **`GenerateComplianceTasksAction`** | Registered via `ActionRegistry.register()` in `onModuleInit()`. For each `(active rule × registered client)`: expand to 6-month window, idempotency check, resolve assignee, create task via shared `@packages/tasks` EntityService. Emits `COMPLIANCE_TASK_GENERATED` per created task. Unit tests: no-rules, no-clients, ambiguity error path, idempotency (second run = 0 creates), correct dueDate per frequency. |
| 8 | **Seed daily scheduled automation** | On module init, seed one automation with slug `compliance-generate-tasks-daily`, cron via `cronForLocalHour`, wired to the action. Idempotent by slug. Admin-editable afterwards. |
| 9 | **Pre-merge checks + PR** | `pnpm --filter @domains/compliance-api test`, `pnpm --filter @apps/recruit build` twice (`APP_DOMAIN=recruit` and `APP_DOMAIN=compliance`), `pnpm lint`. Push, PR, merge, exit worktree, pull main. |

## Known gotchas / things to verify during implementation

- **`apps/recruit/drizzle.config.ts` has stale schema paths** referencing `./src/modules/*` and `packages/addons/tasks/schema/tasks.ts` (no `/api/`). Drizzle migrations have been hand-authored for a while. Don't run `drizzle-kit generate` without fixing the config — it will produce wrong output. Write migrations by hand for PR 2.
- **`validatePayload` rejects unknown fields** — every column compliance services write via the entity service must be declared in the entity config's `fields` block.
- **`TASKS_CONFIG.fieldMeta`** has the polymorphic fields (from PR 1). Compliance's DB will have these columns because the shared migration set includes PR 1's migration.
- **EntityEngine auto-routes** each registered entity to `GET/POST/PATCH/DELETE /entityType`. Compliance's `clients` entity will live at `/api/v1/clients` in compliance's process, but that's fine because recruit's `/api/v1/clients` lives in a different process at a different port.
- **Recruit's compliance URL collision isn't real** — two processes, two ports, two DBs. The shared entity type string `'clients'` is intentional; in each process it refers to that process's own `clients` table.
- **No new app package** — do not create `apps/compliance/`. Same codebase, conditional module load.
- **`cronForLocalHour`** lives in `@packages/common`. Use it for any cron scheduling; never hardcode UTC cron expressions.

## Open questions to revisit

- **Client registration to laws** — how does a compliance client declare which laws it's registered under? Two candidates: (a) a JSONB `registeredLaws: string[]` column on `compliance_clients` with category slugs, (b) a separate `compliance_client_laws` pivot. Decide in task 3/4 based on query patterns. JSONB is simpler; pivot gives better analytics. **My lean: JSONB for PR 2, migrate to pivot if/when we need aggregate queries.**
- **External key storage on tasks** — PR 1 didn't add an `external_key` column. Two options for idempotency in task 7: (a) store the key in a task metadata field if one exists, (b) add `external_key` column to tasks in a follow-up migration, (c) use `relatedEntityType + relatedEntityId + periodStart` as a composite dedupe key without storing the key explicitly. **My lean: (c) — query for existing task where `relatedEntityType='compliance_rule_occurrence'` AND `relatedEntityId=ruleId` AND `title LIKE '...periodStart...'` or embed the period in the title deterministically. Decide during task 7 implementation.**
- **Frontend** — deferred entirely. Figure out after backend is green.

## Resume checklist for tomorrow

1. `cd .claude/worktrees/compliance-service`
2. `git status` — verify on `feat/compliance-service`, clean working tree
3. `git log --oneline origin/main..HEAD` — should be empty or show only this tasks file
4. `TaskList` — the 9 tasks for PR 2 should still be there (tasks 8–16 in the store)
5. Start with task #8 (scaffold `domains/compliance/api/`)
6. Follow task list in order, one commit per task

If the worktree was removed, recreate it:
```
EnterWorktree name=compliance-service
git checkout feat/compliance-service  # or re-create from origin/main if branch was deleted
```

## Reference: PR 1 (already merged)

`feat(tasks): polymorphic related entity + review workflow state` — PR #765
- Added `related_entity_type`, `related_entity_id` columns + composite index to `tasks`
- Renamed workflow: `open→pending`, `done→completed`, added `review` state, kept `cancelled`
- Added `tasks.submitForReview` + `tasks.approveReview` permissions
- 13 unit tests in `packages/addons/tasks/api/__tests__/tasks.config.unit.test.ts`
