## Init vs. Seed

`onModuleInit` is for **in-memory registry registration only**. Anything that writes to the database lives in a CLI seed script.

### The rule

**Allowed at `onModuleInit`** (pure, in-memory, idempotent):
- Registering permission slugs with `RbacRegistryService` (or via `RbacIntegrationModule.forFeature`)
- Registering auditable event metadata with `AuditRegistryService`
- Registering domain-event constants with `EventRegistryService`
- Populating field-definition / workflow-definition caches *from data already loaded by another lifecycle phase* (e.g. reading from a registry, computing derived state)
- Wiring extension providers into a registry

**Forbidden at `onModuleInit`** (any DB write):
- `db.insert(...)`, `db.update(...)`, `db.delete(...)`
- `service.create(...)` / `service.upsert(...)` where the service hits the DB
- "Seed if missing" idempotency loops
- Schema reconciliation, ALTERs, or DDL
- Cache reloads that themselves trigger DB INSERTs to refill missing rows

### Why

- **Boot order isn't transactional.** Two modules whose `onModuleInit` both write to the DB have undefined ordering w.r.t. each other and w.r.t. migrations. There's no rollback if the second one fails.
- **Idempotency contracts leak into runtime.** "What happens on second boot?" / "what happens after a state rename in code?" / "what happens when two pods boot at the same time?" are all questions with no good answer when seeding runs at boot. They evaporate when seeding runs from a single CLI invocation.
- **Tests fight it.** Test harnesses that truncate the DB between specs have to either preserve seeded rows or replay seeds — both leak boot-time concerns into test runtime, and either path silently breaks when a new boot-seeded module is added.
- **Multi-instance deployments race.** Two API pods booting at the same time both try to insert the same rows; one wins, one logs an error or violates a unique constraint. Seeds that run from `cli/seed.ts` run exactly once, in a controlled environment, with an explicit operator.
- **Code is the source of truth for static config.** Workflow definitions, permission slugs, event names — these live in TypeScript and never need to be "seeded into the DB" to be authoritative. The runtime registry reads them from code; the DB only holds rows that real users created.

### Where seeds live

Every app exposes two CLI entry points:

```
apps/<app>/src/cli/migrate.ts   — runs migrations
apps/<app>/src/cli/seed.ts      — runs system + (optionally) demo seeds
```

System seeds are idempotent platform fixtures (e.g. RBAC role rows, default settings) that an empty production database needs to function. Demo seeds are gated behind `ALLOW_DEMO_SEED=true` and create realistic-looking sample data.

Each module that has DB-resident fixtures exposes them via `<module>.seeds.ts` (or `<module>.<demo|system>.seeds.ts`) and the app composes them in `cli/seed.ts`. A module never seeds itself at boot.

### What this means for static config (workflows, permissions, etc.)

Static config defined in code (e.g. a workflow declared via `defineWorkflow(...)`, a permission manifest from `crudPermissionManifests(...)`, an event constant) **does not get seeded to the DB at all**. The runtime registry holds it in memory. The DB only stores user-created instances of the same kind:

- Workflow defs: `defineWorkflow(...)` lives in `WorkflowRegistryService` cache (in-memory). Admin-created workflows persist in `workflow_definitions` and load into the same cache on boot.
- Permissions: code-declared manifests live in `RbacRegistryService` cache. There is no admin-defined permission table.
- Event names: code-declared constants live in `EventRegistryService` cache. No DB.

Adding a new code-defined item is a code change, not a migration + seed.

### How to apply

Before adding anything to a module's `onModuleInit`:

1. Does it write to the DB? If yes, **stop**. Move it to `<module>.seeds.ts` and add it to `cli/seed.ts`.
2. Does it depend on the registry being populated by another module's init? If yes, document the implicit boot order (or refactor to an explicit registry-of-registries).
3. Does it need to run on a per-pod basis (cache warm-up, registry registration)? Then it's a legitimate init concern. Keep it pure — read code constants, push to in-memory caches, return.

When a code-resident static config "needs" to be in the DB to satisfy a foreign key constraint from another table, **that's the signal to drop the FK**, not to seed the row at boot. See `workflow_transition_history` after the in-memory workflows pivot — `workflow_definition_id` is plain text now, with no FK to `workflow_definitions`, because code-defined definitions are never DB rows.
