# Compliance Domain — Audit Status

Resumable status doc for the audit-driven cleanup that started 2026-04-30.
Companion to `todos.md`. Each finding tracks: severity, file:line, root issue,
status, PR (if shipped), owner-only notes for the next pass.

**Last updated:** 2026-04-30.
**Tests on `main`:** 374/374 (compliance-api), 30/30 (compliance-ui).

---

## How to resume tomorrow

1. **Pull main** — every shipped PR merged before sundown 2026-04-30.
2. **Read this file end-to-end** for context.
3. **Pick the next item from §3 ("Remaining work")**, in priority order. The
   item links to the audit finding, the recommended PR scope, and any
   prerequisites.
4. **Default to "PR-M next"** if nothing else has changed — it's the last
   actionable HIGH-severity finding from the audit series.

---

## 1. Audit lenses run

Five separate audits ran end-to-end on the compliance domain. Reports were
returned by spawned agents and consolidated into the inventory in §2.

| Lens | Scope | Findings |
|---|---|---|
| Phase-3 data-fetching audit | `.claude/rules/data-fetching.md` adherence | 8 HIGH, 17 MED, 6 LOW |
| Soft-delete + tenancy | every raw Drizzle/SQL query in `domains/compliance/api` | 23 HIGH, 35 MED, 0 LOW |
| Security / RBAC | endpoint perm gates, `accessCtx` flow, 401/403 coverage | 0 HIGH, 9 MED, 3 LOW |
| Workflow guard coverage | required permissions, reason/comment, guard tests | 7 HIGH, 8 MED, 4 LOW |
| Test coverage | services × unit/integration coverage matrix | 3 HIGH, 4 MED, 2 LOW |

Each finding from these audits is tracked in §2 with its current state.

---

## 2. Inventory

Severity legend: **HIGH** = blocking review, **MED** = should fix, **LOW** =
polish. Status legend: ✅ shipped, ⏳ in-flight, ⛔ deferred-by-design (not a
regression), ⏸️ pending (next-PR candidate).

### 2.1 Data-fetching rule violations (Phase-3 audit)

| # | Severity | Location | Issue | Status | Reference |
|---|---|---|---|---|---|
| H1 | HIGH | `clients/ClientsPage.tsx:65-110` | `useClientsList({limit:100})` + `useUsersList({limit:500})` JS-joined | ✅ | PR #1202 |
| H2 | HIGH | `compliance-rules/ComplianceRulesPage.tsx:50-91` | `limit:200` + `useLawsLookup({limit:1000})` JS-joined | ✅ | PR #1203 |
| H3 | HIGH | `useComplianceRulesApi.ts:47` | `useLawsLookup` defaulted to `limit:1000` | ✅ | PR #1203 |
| H4 | HIGH | `clients/ClientsPage.tsx:66`, `FilingDetailDrawer.tsx:267` | `useUsersList({limit:500})` | ✅ | PR #1202 |
| H5 | HIGH | `laws/LawsLibraryPage.tsx:22` | `useLawsList({limit:500})` then JS tree | ✅ | PR #1204 (`/laws/tree`) |
| H6 | HIGH | `clients/ClientDetailPage.tsx:92-95` | JS `.filter` over 10-row page for tabs | ✅ | PR #1205 (bucket alias) |
| H7 | HIGH | `reports/ReportsPage.tsx:155-200` | JS `.filter` on rows; no debounce, no server `q` | ✅ | PR #1206 |
| H8 | HIGH | `automations/compliance-filings-generator.service.ts:181-283` | O(N·M) round-trips per (reg, occ) | ✅ | PR #1207 |
| M9 | MED | `roles/AddMemberDropdown.tsx` | `useUsers` per-keystroke, no debounce | ✅ | PR #1209 |
| M10 | MED | `users/UsersPage.tsx:42-66` | search un-debounced + page-reset per keystroke | ✅ | PR #1209 |
| M11 | MED | `compliance-filings-cancellation.service.ts` | N+1 `recordHistory` in cancel cascade | ✅ | PR #1210 |
| M12 | MED | `client-dormancy.service.ts` | N+1 `recordHistory` in dormancy cascade | ✅ | PR #1210 |
| M13 | MED | `client-registrations.service.ts:197-227` | `registerMany` 2N+1 round-trips | ✅ | PR #1209 |
| M14 | MED | `compliance-rules.service.ts:578-582` | `assertHandlerCanBeDeleted` re-SELECTs handlers | ✅ | PR #1209 |
| M15 | MED | `compliance-rules.service.ts:249-263` | `findActive()` unbounded | ⛔ | Pattern correct: generator iterates every active rule by design; rule count is structurally bounded. |
| M16 | MED | `useClientDetailData.ts:101` | `useClientContacts` capped at 50 | ✅ | PR #1205 (tightened to 10) |
| M17 | MED | `RoleAssignEditor.tsx:26-38` | `useRolesList({limit:100})` + JS filter | ⛔ | Bounded reference data exception applies. |
| M18 | MED | `FilingsPage.tsx:282-285` | `overdueClientCount` derived from legacy 1000-row hook | ✅ | PR #1209 |
| M19 | MED | `OrganizationPage.tsx:19-26` | 2 round-trips for singleton | ⛔ | Fires once per page load; clean fix needs `useSingleton` primitive in entity-engine. Not load-bearing. |
| L20 | LOW | `useComplianceRulesApi.ts:75-86,130-141` | `gcTime:0` defeats prefetch | ✅ | PR #1212 |
| L21 | LOW | `RuleEditPage.tsx:83-90` | imperative `searchLookup` per keystroke, no caching | ✅ | PR #1212 (cached via `queryClient.fetchQuery`) |
| L22 | LOW | `NotificationPanel.tsx:59` | `useNotifications({limit:50})` no truncation indicator | ✅ | PR #1212 |
| L23 | LOW | `ReportsPage.tsx:204-221` | search `.toLowerCase()` per render | ✅ | PR #1206 (incidentally) |
| L24 | LOW | `ClientsPage.tsx:140-147` | KPI tiles reduced over client-side page | ✅ | PR #1202 (incidentally) |
| L25 | LOW | `UsersPage.tsx:48-51` | `setPage(1)` per keystroke | ✅ | PR #1209 (incidentally) |

### 2.2 Soft-delete + tenancy

The audit found 23 HIGH soft-delete leaks (raw queries reading/mutating
soft-delete tables without `deleted_at IS NULL`) and 35 MED tenancy gaps
(raw queries on potentially-tenanted tables without `withTenant` —
forward-compat hazards, no current bug).

**Resolution shape:** PR #1216 introduced `withScope(table, …)` in
`@packages/database` (table-aware composer of soft-delete + tenancy +
future actor-scope) and `.claude/rules/data-scoping.md` (mandatory rule
banning raw queries that bypass it). The 23 HIGH soft-delete sites were
swept in the same PR.

| Severity | Count | Status | Reference |
|---|---|---|---|
| HIGH (soft-delete leaks) | 23 | ✅ | PR #1216 — sweep across 9 files in `domains/compliance/api/` |
| MED (`withTenant` adoption gaps) | 35 | ⏸️ | Opportunistic per the rule's grandfathering policy. Convert call sites to `withScope` when files are touched for other reasons. No coordinated sweep needed today (`withTenant` is a no-op when tenancy isn't active). |
| LOW | 0 | — | None actionable. |

Site-by-site detail of the 35 MED items lives in the original audit report;
not duplicated here because they all reduce to "swap `withTenant(table, …)` →
`withScope(table, …)`" or "wrap the query in `withScope` if neither was
called". Inventory lives in the PR-J discussion (audit transcript) for the
day someone runs that sweep.

### 2.3 Security / RBAC

All 9 MED findings cluster around one root: `accessCtx` not flowing into
the Phase-3 raw SQL paths (`ClientsRollupService`, `ComplianceRulesService`
custom list, `ComplianceReportsService`, `ComplianceFilingsService.countOverdueDistinctClients`).
Plus two registration endpoints that didn't scope-check the parent client.

| # | Severity | Endpoint / method | Status | Reference |
|---|---|---|---|---|
| S1 | MED | `ClientsController.list` | ✅ | PR #1221 |
| S2 | MED | `ClientsController.summary` + `handlerOptions` | ✅ | PR #1221 |
| S3 | MED | `ComplianceRulesController.list` + `summary` | ✅ | PR #1221 |
| S4 | MED | `ComplianceReportsController` (5 endpoints) | ✅ | PR #1221 |
| S5 | MED | `ComplianceRulesController.deprecate` (incl. preview/edit-constraints) | ✅ | PR #1221 |
| S6 | MED | `ClientsController` registration endpoints (3) | ✅ | PR #1221 |
| S7 | MED | `ComplianceFilingsService.countOverdueDistinctClients` | ✅ | PR #1221 |
| S8 | MED | Missing 401/403 coverage on ~70% of compliance endpoints | ⏸️ | Per-endpoint pairs to add to integration suites. Mechanical, but bulky. Not load-bearing for any specific finding — but CLAUDE.md mandates 401+403 for every endpoint. |
| S9 | MED | Client transitions (`active → dormant`) and rule transitions (`active → deprecated`) collapse onto generic `*.update` perm | ⏸️ | See §2.4 W2/W3 — same items, tracked under workflow guards. |
| S10 | LOW | `COMPLIANCE_PERMISSIONS.FILINGS_*` constants are unused | ⏸️ | Doc-fixture cleanup. |
| S11 | LOW | `previewTransition` reuses destructive perm | ⏸️ | Documented as deliberate; flag for explicit confirmation. |
| S12 | LOW | `restore`/`clone` don't take `accessCtx` | ⏸️ | Cross-cutting (affects all entities, not just compliance); needs entity-engine API change. |

### 2.4 Workflow guard coverage

The audit found 7 HIGH issues — all clustering around destructive transitions
that lack dedicated permissions and rely on generic `*.update`.

| # | Severity | Workflow / transition | Status | Notes |
|---|---|---|---|---|
| W1 | HIGH | client-registrations / cascade UPDATE bypasses workflow engine | ⛔ | Documented design (`compliance-filings-cancellation.service.ts`); the cascade actor holds `client-registrations.delete`, not `compliance-filings.close`. PR #1210 batched the history write but kept the bypass. |
| W2 | HIGH | rule `active → deprecated` has no `requiredPermissions` | ⏸️ | **PR-M candidate.** Add `compliance-rules.deprecate` perm + gate the transition. |
| W3 | HIGH | rule `deprecated → active` has no `requiredPermissions` | ⏸️ | **PR-M candidate.** Same shape — `compliance-rules.reactivate` (or reuse deprecate). |
| W4 | HIGH | client `active → dormant` has no `requiredPermissions` | ⏸️ | **PR-M candidate.** Add `clients.dormantise` perm. |
| W5 | HIGH | client `dormant → active` has no `requiredPermissions` | ⏸️ | **PR-M candidate.** |
| W6 | HIGH | client-dormancy cascade UPDATE bypasses workflow engine | ⛔ | Documented design (sweepLateFilings has explicit comment); audit trail carried by dormantisation event. |
| W7 | HIGH | `ComplianceRulesService.deprecate` direct UPDATE bypasses engine | ⏸️ | **PR-M candidate.** When PR-M lands and `compliance-rules.deprecate` becomes a real per-transition perm, this code path silently bypasses it unless rerouted through `entityService.transition` or duplicates the gate check explicitly. |
| M-WF1 | MED | filing rule `draft → deprecated` no `requiredPermissions` | ⏸️ | Same as W2 — bundle into PR-M. |
| M-WF2 | MED | filing transitions `in_progress → pending` (release), `review → in_progress` (rework), `rejected → in_progress` use bare-string transitions with no gate | ⏸️ | Could land with PR-M or as a separate `compliance-filings.release/rework` perm grant. Lower urgency. |
| M-WF3 | MED | All 4 filing-cancel transitions lack `reasonRequired`/`commentRequired` | ⏸️ | Audit-trail polish. Bundle with PR-M. |
| M-WF4 | MED | rule `active → deprecated` lacks reason/comment | ⏸️ | Same. |
| M-WF5 | MED | filing `review → completed` no `commentRequired` | ⏸️ | Compliance audit usually wants reviewer signoff. |
| M-WF6 | MED | filing reopen transitions (completed/cancelled → in_progress) lack reason/comment | ⏸️ | Can't reconstruct why a closed filing was revived. |
| M-WF7 | MED | client `dormant → active` lacks reason/comment | ⏸️ | Symmetric to dormantisation, which DOES require both. |
| M-WF8 | MED | `warn-dormant-cascade` advisory guard is untested | ⏸️ | Add a unit test asserting warning emission. |
| L-WF1 | LOW | rule `deprecated → active` lacks reason/comment | ⏸️ | Polish. |
| L-WF2 | LOW | Stale doc comment refs `compliance-client-dormancy-warning` (the registered guard is `warn-dormant-cascade`) | ⏸️ | Doc fix. |

### 2.5 Test coverage

| # | Severity | Service | Status | Reference |
|---|---|---|---|---|
| T1 | HIGH | `ClientDormancyService` (cascade + sweep + race-guard) | ✅ | PR #1223 (21 unit tests) |
| T2 | HIGH | `ClientsRollupService` (375 lines hand-rolled SQL) | ✅ | PR #1223 (12 unit tests) |
| T3 | HIGH | `ComplianceReportsService` (5 aggregations) | ✅ | PR #1223 (17 unit tests) |
| T4 | MED | `ComplianceFilingsCancellationService` direct tests | ⏸️ | Indirectly covered via rules deprecation + registration deactivation. Cardinality tests would add value. |
| T5 | MED | `LawsService.getTree` | ⏸️ | Tree-build branchiness untested. |
| T6 | MED | ~70% of endpoints missing 401/403 coverage | ⏸️ | Same as S8. |
| T7 | MED | `ComplianceFilingsAssigneeCleanupService` skips terminal-status filter assertion | ⏸️ | Mock-driven gap. |
| T8 | LOW | UI hooks (`useClientsApi`, etc.) sparse | ⏸️ | UI test culture is light by convention. |
| T9 | LOW | Composite UI components (`ComplianceCalendar`, `FilingTimeline`) untested | ⏸️ | Same. |

### 2.6 Pre-existing infrastructure debt (audit-adjacent)

These aren't audit findings per se but block deeper integration coverage.

- **Compliance integration-test DI gap** — `ComplianceReportsService` requires
  `OrgUnitService` but the test setup's `TestOrgUnitsModule` isn't visible
  inside the reports module. Fixed for migration via `directoryAddon` in PR
  #1202; the runtime DI fix is unrelated to this series. Blocks adding
  integration tests for rollup / reports / dormancy SQL semantics.
- **Legacy `useComplianceFilingRows`** — 4× `limit=1000` powering FilingsPage
  kanban + calendar. Pre-existing PR-3b follow-up tracked in the data-fetching
  audit but left out of scope for the audit cleanup. Not a regression — the
  audit's H6/H7/H8 fixes carved their slices around this hook.

---

## 3. Remaining work

Priority-ordered. Each row is a candidate PR with the audit findings it
closes.

### 3.1 PR-M — Destructive-transition permissions

**Closes:** W2, W3, W4, W5, W7, M-WF1 (workflow), S9 (security duplicate of W2/W4).

**Scope:**
1. Add three new permission slugs:
   - `clients.dormantise` (gates `active ↔ dormant`)
   - `compliance-rules.deprecate` (gates `* → deprecated`)
   - Optionally `compliance-rules.reactivate` (gates `deprecated → active`),
     or fold into `deprecate`.
2. Register the slugs in compliance's permission manifest registration.
3. Wire them as `requiredPermissions` on the workflow-definition transitions
   in `clients.config.ts` and `rules.config.ts`.
4. Reroute `ComplianceRulesService.deprecate` through
   `entityService.transition` (or duplicate the gate check explicitly) so the
   direct UPDATE bypass doesn't silently violate the new gate. Same shape as
   `ClientsService.transition`'s decomposition into `validateTransition` /
   `applyTransition` / `emitTransitionEvent`.
5. Drive-by `reasonRequired: true, commentRequired: true` on the four filing
   `*-cancelled` transitions (M-WF3) and the rule deprecation transition
   (M-WF4) — destructive transitions deserve audit-trail entries.
6. Update `system-roles.unit.test.ts` seeds + integration-test factories to
   grant the new perms to the right roles.
7. Add 401/403 + happy-path tests on the workflow transition endpoints to
   pin the new behaviour.

**Estimated:** 1 worktree, 2-3 commits, ~8 files modified.

**Prerequisites:** None. PR-K's `accessCtx` plumbing already lands the rule
fetch through `entityService.findOneOrFail(id, accessCtx)`, so the deprecate
flow is ready for the perm gate.

### 3.2 PR-N — Reason/comment on destructive transitions (audit-trail polish)

**Closes:** M-WF2, M-WF3, M-WF4, M-WF5, M-WF6, M-WF7, L-WF1.

**Scope:** Set `reasonRequired: true, commentRequired: true` on:
- 4× filing `*-cancelled` transitions
- Filing reopen (completed → in_progress, cancelled → in_progress)
- Filing review → completed (commentRequired only — reviewer signoff)
- Client dormant → active (currently asymmetric with active → dormant)
- Rule deprecated → active

Update controller DTOs + UI dialogs to collect reason/comment. Add tests.

**Bundle option:** Could land with PR-M. The work overlaps the workflow
definitions touched there.

### 3.3 PR-O — 401/403 coverage sweep

**Closes:** S8, T6.

**Scope:** Add per-endpoint 401 (anon) + 403 (read-only token) integration
test pairs for every endpoint missing them — roughly 50 endpoint × 2
assertions. Mechanical work. Pattern lives in
`compliance-filings-scopes.integration.test.ts` and the existing positive
coverage; just multiply.

**Estimated:** Bigger but lower-risk PR; could split by sub-area
(clients, rules, reports, etc.).

### 3.4 PR-P — `withTenant` → `withScope` adoption sweep

**Closes:** the 35 MED tenancy adoption gaps from §2.2.

**Scope:** Mechanical conversion across compliance services. `withTenant(t, …)`
→ `withScope(t, …)` everywhere. The data-scoping rule grandfathers existing
sites, so this is opt-in cleanup, not blocking.

**When to do it:** Either as a coordinated sweep (one big PR), or
opportunistically as files are touched for other reasons. The rule's
grandfathering language explicitly endorses both.

### 3.5 Compliance integration-test DI fix → integration coverage for rollup/reports

**Unblocks:** SQL-level coverage for `ClientsRollupService`,
`ComplianceReportsService`, `ClientDormancyService` cascade.

**Scope:** Fix the DI gap (`TestOrgUnitsModule` not visible in
`ComplianceReportsService`'s module). Then add integration tests against a
real DB for the aggregation methods that unit tests can't validate.

**Status:** Mentioned in §2.6. Pre-existing debt that blocks this but not
PR-M/N/O/P.

### 3.6 Smaller / lower-priority

- **W6, W1** — `cancelInFlightFilings`/`sweepLateFilings`/`cancelFilings`
  bypass the workflow engine. Documented design. Could be revisited if a
  future change requires per-transition permission enforcement on cascades.
- **M15** (`findActive` unbounded) — pattern is correct; non-issue today.
  Re-evaluate if rule count grows past low hundreds.
- **M19** (Org singleton 2 round-trips) — needs a `useSingleton` primitive
  in entity-engine. Not load-bearing for one consumer.
- **M17** (`RoleAssignEditor` `useRolesList`) — bounded reference data
  exception applies. Re-evaluate if roles grow past dozens.
- **S10/S11/S12** — doc/cosmetic.
- **T4/T5/T7** — coverage gaps that integration tests would cover better.
- **T8/T9** — UI test gaps; convention-driven, not load-bearing.

---

## 4. Shipped PRs index

| PR | Title (abbrev) | Closes | Date |
|---|---|---|---|
| #1202 | server-side ClientsPage + rollups | H1, H4, L24 | 2026-04-30 |
| #1203 | server-side ComplianceRulesPage | H2, H3 | 2026-04-30 |
| #1204 | `/laws/tree` endpoint | H5 | 2026-04-30 |
| #1205 | filings bucket alias + ClientDetail tabs | H6, M16 | 2026-04-30 |
| #1206 | ReportsPage server search | H7, L23 | 2026-04-30 |
| #1207 | filings generator batching | H8 | 2026-04-30 |
| #1209 | MED batch (debounce, batched registerMany, hoist handlers, server overdueClientCount) | M9, M10, M13, M14, M18, L25 | 2026-04-30 |
| #1210 | `recordHistoryBatch` + cascade adoption | M11, M12 | 2026-04-30 |
| #1212 | LOW batch (gcTime, cached lookup, notification truncation) | L20, L21, L22 | 2026-04-30 |
| #1216 | `withScope` helper + data-scoping rule + soft-delete sweep | 23 soft-delete HIGHs | 2026-04-30 |
| #1221 | `DataAccessScopeService` + accessCtx plumbing | S1-S7 | 2026-04-30 |
| #1223 | unit tests for dormancy / rollup / reports | T1-T3 | 2026-04-30 |

**Net effect:** 12 PRs, all shipped 2026-04-30. Closed every HIGH finding
across all five audit lenses (HIGH count: 33 HIGH items at audit start, 0
HIGH actionable items remaining — only design-skipped items left). Most MED
items closed; remaining MEDs are documented above with explicit reasoning.

---

## 5. Architecture artifacts dropped along the way

Worth knowing about for next session:

- **`@packages/database` exports `withScope(table, …)`** + `withScopeIncludingDeleted` + `tenantSqlCondition`. Mandatory primitive for raw queries per `.claude/rules/data-scoping.md`.
- **`@packages/platform/rbac` exports `DataAccessScopeService.buildPredicate(ctx, { anchors, inlineResolvers? })`**. Foundation-tier primitive for actor-scope predicates. Works with or without entity-engine. `EntityService.getScopePredicate(ctx)` is the convenience wrapper.
- **`@packages/addons/workflows` exports `WorkflowEngineService.recordHistoryBatch(rows, tx)`**. Bulk-insert variant of `recordHistory`. Use for cascade paths.
- **`.claude/rules/data-scoping.md`** auto-loads now. Mandates `withScope` for all raw queries; bans the `notDeleted` + `withTenant` two-call pattern in new code.

These are the load-bearing primitives the audit cleanup added. PR-M
through PR-P will lean on them, especially `entityService.getScopePredicate`
when wiring perm checks at controller level and `recordHistoryBatch` if
PR-M decomposes the rule deprecate flow into engine primitives.
