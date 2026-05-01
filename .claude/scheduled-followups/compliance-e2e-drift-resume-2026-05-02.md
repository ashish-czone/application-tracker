# Resume: Compliance E2E drift cleanup (started 2026-05-01)

## What's already shipped

| PR | What | Merged |
|---|---|---|
| #1251 | Compile-time boot fixes (3 stale paths + 1 rename + 1 BaseCrudService gap) | 2026-05-01 |
| #1252 | Per-module reports refactor (decomposed `ComplianceReportsService` into `compliance-filings.reports.service` + app-level `org-units.reports.service`) | 2026-05-01 |
| #1253 | Partial e2e drift cleanup (contacts fixture + `/clients` 500 fix) | 2026-05-01 |

## State on main as of 2026-05-01 18:00

`apps/compliance` boots cleanly. Build green. Domain unit tests 394/394, app unit tests 7/7. Compliance e2e baseline at #1252's tip: 65/91 pass, 26 fail. After #1253 (partial fix), expected to be roughly **75-80 / 91** pass — the contacts fixture fix and clients list fix together unblock around 10-15 tests; the rest still fail on workflow-registry resets.

## What's left — 2 drift categories, ONE root cause

Both blocking failures stem from the same place:

`TestHooksService.resetState()` (in `apps/compliance/src/modules/test-hooks/test-hooks.service.ts`) truncates `workflow_definitions` between e2e specs and then re-seeds via `seedAllWorkflows()`, which only iterates entity configs and seeds workflows whose **field meta** is typed `workflow`. After the camp-B workflow extraction (PR #1242), `RULES_WORKFLOW` / `COMPLIANCE_FILINGS_WORKFLOW` / `CLIENT_STATUS_WORKFLOW` are registered via `WorkflowsModule.forFeature(...)` and their entity-config fields are typed `text` — so `seedWorkflows()` skips them and they vanish after the first reset.

Visible failures:
- `POST /compliance-rules/:id/transition → 400 "No workflow found for field 'status' on 'compliance-rules'"`
- `POST /clients/:id/transition → 400 "Entity has no current state for field 'status'"` (most likely the same root cause — once the workflow re-seed is fixed, the seeded clients should also have a starting state again)

## Open architectural call (resume here)

The user paused on this question — pick one before the next session writes any code:

### Option 1 — Package change in `@packages/workflows`

Add a `WorkflowFeatureRegistry` service (~30 lines) to the workflows addon. It tracks every def passed to `WorkflowsModule.forFeature(...)` across the app and exposes:

```ts
@Injectable()
export class WorkflowFeatureRegistry {
  private readonly defs: WorkflowDefinition[] = [];

  register(def: WorkflowDefinition): void { /* idempotent push */ }
  getAll(): readonly WorkflowDefinition[] { return this.defs; }
  async reseedAll(): Promise<void> { /* re-create defs missing from runtime registry */ }
}
```

`WorkflowFeatureRegistrations.onModuleInit` calls `featureRegistry.register(def)` for each def before doing the existing DB seed. `TestHooksService.seedAllWorkflows` injects `WorkflowFeatureRegistry` and calls `await featureRegistry.reseedAll()` after the existing entity-engine workflow-field seed.

**Pros:** correct long-term home; benefits every app using camp-B workflows; tests don't need to know about each domain's defs by name.

**Cons:** package-level change, needs review under `confirm-package-changes` rule.

### Option 2 — App-only change in `apps/compliance/src/modules/test-hooks/`

`TestHooksService` imports each known workflow def directly:

```ts
import { RULES_WORKFLOW } from '@domains/compliance-api/rules/rules.workflow';
import { COMPLIANCE_FILINGS_WORKFLOW } from '@domains/compliance-api/compliance-filings/compliance-filings.workflow';
import { CLIENT_STATUS_WORKFLOW } from '@domains/compliance-api/clients/clients.workflow';
```

Replays seeding inline using `WorkflowExtension.createDefinition / createState / createTransition` against each one after truncate.

**Pros:** no package change; faster to land.

**Cons:** every new camp-B workflow has to remember to be added here too; couples test-hooks to every domain workflow file by name; replay logic duplicates `WorkflowFeatureRegistrations.registerOnce`.

### Recommendation

**Option 1.** The duplication cost of Option 2 multiplies as more domains adopt camp-B (recruit, projects, agency are all on the path). The `feedback_no_platform_plumbing` rule cuts the other way — but a registry that tracks what's already passed to `forFeature()` isn't new plumbing, it's making the existing pattern observable. Worth one round of confirmation with the user; expected to be approved.

## How to resume tomorrow

1. `cd /Users/ashishmacmini/Public/Sites/starter-template && git checkout main && git pull` — verify #1253 landed.
2. `EnterWorktree` with name `fix-workflow-feature-reseed` (or similar).
3. `git fetch origin main && git checkout -b fix/workflow-feature-reseed origin/main`.
4. Confirm Option 1 or Option 2 with the user, then implement.
5. Reset compliance DB and re-run e2e to confirm 91/91:
   ```
   PGPASSWORD=dev psql -h localhost -p 5432 -U dev -d postgres -c "DROP DATABASE compliance; CREATE DATABASE compliance OWNER dev"
   pnpm --filter @apps/compliance run db:migrate
   pnpm --filter @apps/compliance run db:seed:system
   ALLOW_DEMO_SEED=true pnpm --filter @apps/compliance run db:seed:demo
   cp /Users/ashishmacmini/Public/Sites/starter-template/apps/compliance/.env apps/compliance/.env
   cd e2e-compliance && npx playwright test
   ```
6. Push, PR, merge, exit, pull.

## Files relevant to the fix (ready-to-grep paths)

- `packages/addons/workflows/api/workflows-feature.module.ts` — `WorkflowFeatureRegistrations` (private, currently does seeding inside `registerOnce`)
- `packages/addons/workflows/api/services/workflow-registry.service.ts` — `WorkflowRegistryService` (cache + DB CRUD)
- `packages/addons/workflows/api/index.ts` — package barrel
- `apps/compliance/src/modules/test-hooks/test-hooks.service.ts` — `seedAllWorkflows()` is the call site that needs to also reseed feature defs

## Conversation context (for the model)

- User paused with "save session details so we can continue from here tomorrow" while I was waiting for them to choose Option 1 vs Option 2.
- Worktree `fix-compliance-e2e-drift` was exited and removed at session end.
- Background API process (`apps/compliance` on :3012) was killed before exit.
- Auto-memory entry pointing here: `reference_compliance_e2e_resume.md`.
