## Actor-Scope (Row-Level RBAC) Rules

These rules are **strict**. Violations are blocking review feedback. Code that skips them MUST NOT be merged, even as a stop-gap. The failure mode is silent: a user with scope `'creator' | 'assigned' | 'team'` sees firm-wide rows on list/findOne with no error, no log, no test failure. Nothing in the type system catches it.

This rule is the third leg of data scoping. The first two — soft-delete and tenant — are covered by `.claude/rules/data-scoping.md` via `withScope(table, …)`. **Both rules must hold.** A correct query applies *all three* legs.

### Why this rule exists

The platform supports row-bound permission scopes — `<slug>.read = 'creator'`, `'assigned'`, `'team'`, `'unit'`, `'descendants'`. These are real product features (`compliance-filings` is the canonical example: assignees see their assigned filings, team leads see their team's pool). The check is "does the row's anchor columns match the user's scope?" — answerable only at the data layer because only the row's `assigneeId` / `createdBy` / `teamId` reveals the answer.

The platform exposes one primitive for this: `DataAccessScopeService.buildPredicate(ctx, { anchors, inlineResolvers? })`. It returns `SQL | undefined`:

- `undefined` when the user's scope is `'any'` (admin) — caller adds nothing.
- `1=0` when the user's scope is empty / unresolvable — caller short-circuits to no rows.
- A composed `OR(...)` of per-scope predicates otherwise.

The base CRUD service (`@packages/crud-base/BaseCrudService`) wires this automatically when an entity registers `scope: { anchors, … }` via `createCrudProvider`. Hand-rolled service code — non-default permissions, custom aggregations, report queries — calls `buildPredicate` explicitly and ANDs the result into the WHERE.

### The required patterns

**Default CRUD (list / findOne / findOneOrFail / update / softDelete):** register `scope:` on `BaseCrudService` once; pass `accessCtx` through service methods.

```ts
// <entity>.scope.ts
export const FOO_ANCHORS: ScopeAnchorMap = {
  creator: foo.createdBy,
  assignee: foo.assigneeId,
  team: foo.teamId,
};

// <entity>.module.ts
createCrudProvider(FOO_CRUD_TOKEN, foo, {
  slug: 'foo',
  events: { … },
  scope: { anchors: FOO_ANCHORS, inlineResolvers: FOO_INLINE_SCOPES },
});

// <entity>.controller.ts
@Get()
@RequirePermission('foo.read')
list(@Query() q: QueryDto, @AccessContext() ctx?: DataAccessContext) {
  return this.fooService.list(q, ctx);
}

// <entity>.service.ts
list(q: QueryDto, ctx?: DataAccessContext) {
  return this.crud.list(q, ctx);  // base applies scope from registration
}
```

**Non-default permissions, raw SQL, custom aggregations:** call `buildPredicate` explicitly with the anchors for the entity and AND it into `withScope`.

```ts
async getReport(today: string, ctx?: DataAccessContext) {
  const scopePredicate = ctx
    ? await this.dataAccessScope.buildPredicate(ctx, {
        anchors: FOO_ANCHORS,
        inlineResolvers: FOO_INLINE_SCOPES,
      })
    : undefined;

  const where = withScope(foo, scopePredicate, eq(foo.kind, 'X'));

  return this.database.db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE …) FROM ${foo}
    ${where ? sql`WHERE ${where}` : sql``}
  `);
}
```

`compliance-filings.scope.ts` ships a thin `buildFilingsScopePredicate(dataAccessScope, accessCtx)` helper that wraps the canonical anchors+inline-scopes for that entity — five report endpoints + `getSummary` use it. Other entities should follow the same pattern.

### Joined tables: the driver is the authorization root

When a list / findOne / aggregation joins additional tables (for display columns or attribute filters), the actor-scope predicate is applied **only to the driver** — the table the query is rooted on. Joined tables do **not** need their `buildPredicate(...)` ANDed in.

**The reasoning:**

- The driver's scope predicate already established that the user is allowed to see this row.
- Joined columns are display data of the authorized parent — once the user clears the bar to see the parent, the parent's labeled fields come along.
- Re-scoping every joined table would conflate attribute filters (`WHERE clients.industry = 'tech'`) with scope filters, breaking natural query semantics. A filter on a joined column should mean "rows whose joined attribute matches", not "rows whose joined attribute matches **and** I'm assigned to that joinee".

**Concretely:**

| Scope dimension | Driver | Joined tables |
|---|---|---|
| Actor-scope (`<slug>.read = 'assigned'`) | Apply via `buildPredicate(...)` | **Skip** — driver is authorization root |
| Soft-delete (`deleted_at IS NULL`) | Apply | **Apply** per-table |
| Tenant (`tenant_id = $current`) | Apply | **Apply** per-table |

`withScope(joinedTable, …)` on the JOIN ON or WHERE handles the bottom two automatically. The actor-scope predicate is built once, for the driver, and ANDed into the WHERE.

**Example — filings list with display joins:**

```ts
const scopePredicate = await this.dataAccessScope.buildPredicate(accessCtx, {
  anchors: COMPLIANCE_FILINGS_ANCHORS,
  inlineResolvers: COMPLIANCE_FILINGS_INLINE_SCOPES,
});

await this.database.db
  .select({ /* … filings cols + clients.name + users.firstName + orgUnits.name … */ })
  .from(complianceFilings)
  .leftJoin(clients,  withScope(clients,  eq(complianceFilings.clientId,        clients.id)))
  .leftJoin(users,    withScope(users,    eq(complianceFilings.assigneeId,      users.id)))
  .leftJoin(orgUnits, withScope(orgUnits, eq(complianceFilings.assigneeTeamId, orgUnits.id)))
  .where(withScope(complianceFilings, scopePredicate));
//                                    ^^^^^^^^^^^^^^^
//                                    Driver actor-scope is built ONCE and ANDed into the WHERE.
//                                    No buildPredicate call for clients / users / orgUnits.
//
// withScope on each LEFT JOIN ON clause adds soft-delete + tenant
// predicates to the join condition itself — so a filing whose linked
// client is soft-deleted still appears in the list (with clientName =
// NULL) rather than being dropped. orgUnits has neither soft-delete nor
// tenant columns today; withScope is a no-op there but stays in the call
// site so future schema changes pick up automatically.
```

**Caveat — project columns deliberately.** The rule grants visibility of the columns you `SELECT` from the joined row, not the whole row. Don't `SELECT joinedTable.*` and dump it — pick the display columns intentionally. Sensitive columns (`users.salary`, `clients.taxId`) need column-level care regardless of join semantics.

**Caveat — driver authority is the model, not a license.** The rule assumes the product treats joined display data as part of the parent's surface. If a domain ever introduces *truly confidential* joined data that even parent-row holders shouldn't see (NDA-shielded clients, restricted team membership), that needs explicit column-level RBAC — not row-level scope re-application.

### Hard prohibitions

The following are NEVER acceptable, regardless of "this entity doesn't grant scoped reads today" or "internal tool, RBAC doesn't apply":

1. **No raw `db.select()` chain on a scope-bearing table that doesn't apply scope.** Either go through `BaseCrudService` (with `scope:` registered) or call `buildPredicate` explicitly. The structural lint (`pnpm lint:scoping`) flags any service file with a raw query that doesn't import one of `BaseCrudService` / `buildPredicate` / `getScopePredicate`.
2. **No `db.update()` / `db.delete()` chain without scope when the entity has scoped writes.** `update` and `softDelete` on `BaseCrudService` apply the scope predicate to BOTH the pre-read AND the UPDATE/DELETE WHERE. Hand-rolled writes must mirror this — the predicate goes into the same WHERE as `eq(table.id, id)`.
3. **No "the controller already authenticated, RBAC is done" reasoning.** Permission *existence* is gated by `@RequirePermission`. Permission *scope* (which rows the user can see) is row-level and only the data layer can answer. They're independent.
4. **No silent fallback to "no scope predicate" when `buildPredicate` returns `undefined`.** `undefined` means the user has `'any'` scope (intentional admin path). It does NOT mean "scope failed, default to allow." If `accessCtx` itself is `undefined`, the caller is privileged or pre-auth — flag it via the bypass mechanism, don't shrug.
5. **No mixing scope concerns across permission slugs.** A workflow transition gated by `<slug>.deprecate` reads scope from `'<slug>.deprecate'`-derived `accessCtx`, not from `<slug>.read`-derived. Build the right context with `buildAccessContext(user, '<the right slug>')`.
6. **No registering a scope shape on `BaseCrudService` that doesn't match the table's columns.** `anchors: { creator: foo.createdBy }` requires `foo.createdBy` to exist as a Drizzle column. The runtime types catch typos; missing columns silently produce `undefined` predicates that look like `'any'` (the worst possible failure mode).

### What "raw query" means here

The lint and the rule treat as "raw":

- `db.select(…).from(table)` chains
- `db.update(table).set(…)` chains
- `db.delete(table).where(…)` chains
- `db.execute(sql\`…\`)` templates that read or mutate application data

The rule does NOT apply to:

- Seed scripts (`apps/<app>/src/cli/seed.ts`, `<module>.seeds.ts`) — run as a system principal with no actor.
- Migrations (`drizzle/migrations/*.sql`) — schema, not data.
- Test infrastructure (`packages/{core,platform}/testing/*`, `__tests__/`) — runs with synthesised actors, scope explicitly bypassed.
- Privileged sweep jobs that intentionally span actors. Use a verbose name (`buildPredicateBypassingActorScope` etc.) when one lands; document the bypass with an inline comment.

### The bypass mechanism

When a service legitimately needs to span actors (race-guard sweeps, audit-trail readers, control-plane writes), use the explicit bypass:

```ts
// accessCtx intentionally NOT passed — system-principal sweep across all actors.
// The cron runs once per night; visibility leaks aren't a concern because the
// caller is the system, not a user. See AUDIT.md item Q-XX.
const filings = await this.crud.list({}, undefined);
```

The lint accepts these because the file *can* still import `BaseCrudService` (and does) — the raw query check passes. Code review stops on every `accessCtx: undefined` to scope-aware methods and asks "why?". The inline comment is the audit-trail surface.

There is **no** `BaseCrudService.listIncludingOutOfScope` or analogous helper. Scope bypass is one path: pass `undefined`. Naming conventions for explicit-bypass primitives (`buildPredicateBypassingActorScope`) will be added if the pattern recurs frequently enough to warrant it.

### Compliance with this rule today

`compliance-filings` is the only compliance entity with active row-level scope (real anchors + role grants using non-`'any'` scopes). The other entities (`clients`, `client-contacts`, `law-handlers`) have forward-compat-hardened anchors registered on their `BaseCrudService` but no current role grant exercises them. `compliance-rules` and `client-registrations` have no anchor columns — a future scoped grant on either requires a schema migration first (see those modules' inline comments).

`recruit/agency` entities still go through `EntityService` and inherit scope automatically; this rule applies the moment they migrate to `BaseCrudService`.

### Grandfathered offenders

`tools/data-access-scope-allowlist.txt` lists service files that pre-date this rule and contain raw queries without scope-primitive imports. The lint exempts these specific paths so the rule can ratchet — new code can never add a violation, but existing offenders are fixed opportunistically (preferably in dedicated PRs that touch the file anyway).

When fixing a grandfathered file:
1. Add `withScope(table, …)` (or `BaseCrudService` delegation) to every raw query.
2. If the file's queries are scope-bearing, add `scope:` registration or explicit `buildPredicate` calls per the patterns above.
3. Remove the file path from `tools/data-access-scope-allowlist.txt` in the same commit.

### Review checklist

Before approving any PR that adds or modifies a service:

- [ ] Every `db.select() / .update() / .delete() / .execute()` on a scope-bearing table either delegates to `BaseCrudService` or applies a scope predicate from `DataAccessScopeService.buildPredicate(...)`.
- [ ] `BaseCrudService` registrations whose entity has anchor columns include the `scope:` block in `createCrudProvider`.
- [ ] Service methods accepting `accessCtx?: DataAccessContext` actually pass it to scope-aware sub-paths — not silently dropped on the floor.
- [ ] Non-default-permission paths (transitions, custom actions, reports) build `accessCtx` with the right permission slug — `buildAccessContext(user, '<correct-slug>')`, not always `<slug>.read`.
- [ ] No new entry added to `tools/data-access-scope-allowlist.txt` — that file shrinks over time, never grows.
- [ ] No `accessCtx: undefined` passed to a scope-aware method without a one-line comment explaining why.

### Where this rule applies

- All `domains/*/api/` services
- All `apps/*/src/` modules (where they query application data)
- All `packages/addons/*/api/` services (the addon services in `tools/data-access-scope-allowlist.txt` are grandfathered and tracked)
- `packages/platform/*` services where they query application data (rare; most platform services own their own per-package tables)
- NOT inside `packages/platform/rbac/api/data-access-scope.service.ts` (the implementation lives there)
- NOT inside seed scripts, test fixtures, migrations
