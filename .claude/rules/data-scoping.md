## Data Scoping Rules

These rules are **strict**. Violations are blocking review feedback. Code that bypasses them MUST NOT be merged, even as a stop-gap. The failure modes are silent: deleted rows appear in dashboards, cross-tenant rows leak across customers, scoped users see firm-wide aggregates. Nothing in the type system, tests, or logs catches it.

### Why these rules exist

A query that hits a database table is a contract about which rows the caller is allowed to see. The platform has three orthogonal scope dimensions:

1. **Soft-delete** — `deleted_at IS NULL` if the table spreads `softDeleteColumns()`. Reading or mutating tombstoned rows treats deletion as undone.
2. **Tenancy** — `tenant_id = $current` when the deployment is tenanted and the table has the column. Skipping it lets one customer's query touch another customer's data.
3. **Actor scope** — RBAC-derived row predicates from the caller's `DataAccessContext` (assigned-only, unit-only, etc.). Skipping it lets a scoped user see firm-wide rows.

The entity-engine's `EntityService.list/findOne/update/delete` paths apply all three automatically. Hand-rolled Drizzle queries — `db.select()`, `db.update()`, `db.delete()`, `db.execute(sql\`…\`)` — bypass that machinery. Each such query MUST reapply scope manually, and the platform provides one primitive to do it.

### The required primitive

```ts
import { withScope } from '@packages/database';

db.select().from(filings).where(withScope(filings, eq(filings.id, id)))
db.update(filings).set({ status: 'cancelled' })
  .where(withScope(filings, inArray(filings.id, ids)))
db.delete(filings).where(withScope(filings, eq(filings.clientId, cid)))
```

`withScope(table, ...conditions)` introspects the table at runtime:

- If it has `deletedAt`/`deletedBy` columns → adds `deleted_at IS NULL`
- If it has `tenantId` AND a tenant context is active → adds `tenant_id = $current`
- ANDs the caller's conditions in

The same call site is correct on a soft-delete table, a tenanted table, both, or neither. There is no version with a flag — no `{ includeDeleted: true }`, no `{ skipTenant: true }`. Bypasses use a separate, deliberately verbose function (see below).

### Hard prohibitions

The following are NEVER acceptable, regardless of "this table doesn't have soft-delete today" or "tenancy isn't enabled in this app":

1. **No raw `db.select()` chain on application data without `withScope` in the WHERE.** Even on a non-tenanted, non-soft-delete table — `withScope` is a no-op there, but writing it documents that scope was considered. Future schema changes (adding `softDeleteColumns()` or `tenantId`) MUST NOT require re-auditing every call site.
2. **No raw `db.update()` / `db.delete()` chain without `withScope` in the WHERE.** Mutations on tombstoned rows undo deletions silently. Mutations across tenants are a security incident.
3. **No `db.execute(sql\`…\`)` raw template that touches application data without the equivalent inline predicates.** Raw templates can't pass through `withScope` directly — they MUST include `WHERE … deleted_at IS NULL AND ${tenantSqlCondition()}` (or equivalent) explicitly. Use raw SQL only when the shape demands it (`COUNT(DISTINCT)`, `FILTER (WHERE …)`, complex CASE) — and document the scope manually.
4. **No `notDeleted(table)` + `withTenant(table, …)` composition in new code.** The two-call pattern is the failure mode the rule is closing. Old code is grandfathered; new code uses `withScope`.
5. **No "this is internal, RBAC doesn't apply" justification.** Internal services run in transactions whose actor is supplied by the caller; the cascade still has to honor scope. The actor-scope leg activates when row-level RBAC plumbing lands; until then `withScope` is forward-compatible.
6. **No silent scope bypass via `as any` / `unknown` casts on the table parameter.** If the type system rejects `withScope(table, …)`, the table is wrong, not the call.

### The escape hatch

A small number of paths genuinely need to read or mutate tombstoned rows:

- Restore-from-trash flows
- Forensic / audit queries that show "what was deleted"
- Race-guard sweep loops that catch stragglers post-commit (e.g. `ClientDormancyService.sweepLateFilings`)

For these, use the explicit alternative:

```ts
import { withScopeIncludingDeleted } from '@packages/database';

// Tenant scope still applies; soft-delete leg is intentionally skipped.
db.select().from(filings).where(withScopeIncludingDeleted(filings, eq(filings.clientId, cid)))
```

The verbose name is the audit-trail surface. Code review stops on every occurrence and asks "why?". An inline comment documenting the reason is required.

There is **no** `withScopeBypassingTenant`. Cross-tenant reads/writes are never acceptable from application code. If a control-plane or platform-admin path genuinely needs to span tenants, that path uses a separate connection pool with elevated credentials and lives outside this primitive.

### Raw SQL templates

When the query shape genuinely requires `db.execute(sql\`…\`)` — DISTINCT counts, FILTER aggregations, complex CASE — the WHERE clause must include the same predicates `withScope` would have applied:

```ts
import { tenantSqlCondition } from '@packages/database';

await db.execute(sql`
  SELECT COUNT(DISTINCT client_id)::int AS count
  FROM ${filings}
  WHERE deleted_at IS NULL
    AND ${tenantSqlCondition()}
    AND status IN ('pending', 'in_progress')
    AND due_date < ${today}::date
`);
```

`tenantSqlCondition()` returns `tenant_id = $current` when a tenant is active and `TRUE` otherwise — same shape as `withScope` but renderable inside a raw SQL string.

For aggregations that join across tables (clients × filings, etc.), every joined soft-delete or tenanted table needs its own `deleted_at IS NULL` and `tenant_id = $current` clause. There is no "the predicate on the driver table cascades to joins" — it doesn't.

### When the type system can't help

Drizzle column types don't differentiate "table that has `deletedAt`" from "table that doesn't". `withScope` does runtime introspection — meaning a typo (e.g. passing `filing` instead of `filings`) compiles. Mitigations:

- **Code review** — any new raw query in PR diff is read with this rule in mind.
- **Tests over a real DB** — integration tests that hit `db.execute` paths catch most introspection bugs because the predicate fires (or doesn't) against real rows.
- **Lint** — `pnpm lint:scoping` (run as part of `pnpm lint`) flags any service file that contains a raw `db.select/update/delete/execute` chain without importing `withScope` (or `BaseCrudService` / `buildPredicate` for the actor-scope leg covered by `.claude/rules/data-access-scope.md`). Grandfathered files predating the lint live in `tools/data-access-scope-allowlist.txt` and are tracked for opportunistic cleanup. The check is structural — it cannot tell whether `withScope` is correctly applied to the WHERE; that stays a code-review concern.

### Review checklist

Before approving any PR that adds or modifies a raw Drizzle / SQL query, verify:

- [ ] Every `db.select()` / `db.update()` / `db.delete()` chain that touches application data has `withScope(table, …)` in its `.where(…)`.
- [ ] Every `db.execute(sql\`…\`)` template includes `deleted_at IS NULL` (where applicable) and `${tenantSqlCondition()}` in its WHERE.
- [ ] Any joined soft-delete or tenanted table in a multi-table query has its own predicate, not just the driver table.
- [ ] Any use of `withScopeIncludingDeleted` has an inline comment explaining why.
- [ ] No new code uses `notDeleted` + `withTenant` separately when `withScope` would do — the old shape is grandfathered, not extended.
- [ ] No `db.execute` raw template silently omits scope because "the surrounding controller already authenticated the actor" — controller-level auth is permission scope, not row scope.

### Where this rule applies

- All `domains/*/api/` services
- All `apps/*/src/` modules
- All `packages/addons/*/api/` services
- `packages/platform/*` services where they query application data (rare; most platform services own their own per-package tables)
- NOT inside `packages/core/database` itself (the implementation lives there)
- NOT inside seed scripts that run with explicit superuser scope (they document the bypass)

### Migration of existing code

Every raw query in the codebase that predates this rule is grandfathered. New PRs MUST:

- Use `withScope` for new raw queries.
- Convert nearby existing queries in the same file to `withScope` when touching them — opportunistic cleanup, not a forced rewrite.
- A coordinated sweep landing every existing call site at once is acceptable but not required.

The audit feedback that closed compliance HIGH soft-delete findings (PR-J) is the reference implementation — read those diffs to see the canonical pattern.
