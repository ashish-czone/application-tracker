# Compliance V1 — Decisions & Task Tracker

Companion to `specs.md`. This document captures:

1. **Decision log** — every open design question raised during V1 planning, with the options considered, the resolution, and the reasoning.
2. **Pending decisions** — questions still to be worked through before implementation starts on the affected area.
3. **Build task list** — actionable, checkable tasks derived from locked decisions. One task ≈ one commit.

Keep this file up to date as we work. Append new questions at the bottom of §2. When a pending question is resolved, move it into §1 and add any resulting tasks to §3.

---

## 1. Decision log

### Q1 — Should V1 support client groups?

**Decision:** Defer to V2.

**Options considered:**
- (a) No groups in V1 — flat client list. _[chosen]_
- (b) Add a simple `groupName` / `client_groups` lookup — no hierarchy.
- (c) Full parent–subsidiary hierarchy via `parentClientId`.

**Why:** Groups are a reporting lens, not an operational one — every compliance task is filed against a single PAN/GSTIN, so the MVP runs end-to-end without the concept. Adding it later (option b) is a cheap single-column extension; starting with (c) would force design work (group-level dashboards, consolidated billing) that the MVP doesn't need.

---

### Q2 — Task assignment model: team + individual together

**Decision:** `tasks.assigneeTeamId` is **NOT NULL**; `tasks.assigneeId` is **nullable**. The team is the durable owner, the individual is the current doer.

**Options considered:**
- (a) Team NOT NULL, individual nullable — both coexist. _[chosen]_
- (b) Keep both nullable, app-level rules.
- (c) Separate `task_assignments` join table with roles.

**Why:** The MVP requires continuous team-level visibility even when the individual is on leave or terminated — nulling `assigneeId` while the team reference is always set guarantees that invariant at the schema level. (b) loses the invariant; (c) is over-engineering for V1 (no maker–checker, single-owner model).

**Implementation note:** verify whether the current tasks schema has an XOR constraint between `assigneeId` and `assigneeTeamId`. If so, drop it and tighten `assigneeTeamId` to `NOT NULL` in the same migration. If not present, only the NOT NULL tightening is needed.

---

### Q3 — Authorization model for task actions (reassign, review, complete, reopen, close)

**Decision:** Two independent layers, composed on every action:

1. **Permissions on roles** (global "what"). Stable slugs, admin-editable role display names.
2. **Scopes on positions** (local "where"). Scopes already exist on the platform: `own | unit | descendants | all` with position-ranked permissiveness.

An action succeeds iff the user has the required **permission** (via some role) AND the user's position in the relevant org unit grants a **scope** that covers the target task.

**Placement of primitives:**
- **`packages/addons/tasks/`** defines the task-level permission slugs (`tasks.view`, `tasks.pickup`, `tasks.reassign`, `tasks.review`, `tasks.complete`, `tasks.reopen`, `tasks.close`), registers them via a system seed, and enforces action-level guards (permission + scope + task relationship). These are platform primitives — any domain using the tasks package gets them for free.
- **`packages/addons/org-units/`** already owns scopes and the recursive descendant-resolution logic. No change.
- **`domains/compliance/`** owns only the **seeded default roles** (Preparer, Reviewer, Team Lead, Firm Admin) and their permission compositions. Display names and permission sets are admin-editable at runtime.

**Seed placement:**
- Permissions: system seed in the tasks package (load-bearing — RBAC checks fail without them).
- Default roles: system seed in the compliance domain, added to `complianceSystemSeedSources()` in `domains/compliance/api/seeds.ts`.
- Sample user ↔ role assignments: demo seed in the compliance domain.
- **Not** in `onModuleInit` — DB seeds run via CLI (`--kind system|demo`), per project convention.

**"Head of team" convention:**
- Defined as the team member(s) with the **lowest `position.sortOrder`** among that team's actual members — not whoever globally has `sortOrder = 0`.
- Edge cases: co-heads (ties at min sortOrder) → all count as heads; team with no positions assigned → no head, roll up to parent; team with no parent → fall back to users holding `all` scope.
- Implementation uses the platform's existing `getOrgUnitWithDetails` (which already returns `head = members[0]` sorted by position).

**Escalation model** (uses only platform primitives, no new schema):

| Tier | Trigger | Target |
|------|---------|--------|
| T+0 | Due date reached | `task.assigneeId` if set, else all members of `task.assigneeTeamId` |
| T+3 | 3 days overdue | Team head(s) = members of `task.assigneeTeamId` with lowest-sortOrder position |
| T+7 | 7 days overdue | Head(s) of `parent_of(task.assigneeTeamId)` |
| Fallback | No parent or no head at a tier | Roll up early; ultimately users holding `all` scope on compliance tasks (firm admins) |
| Dedup | Always | Escalation recipients deduped against already-notified targets |

Escalation **adds visibility only** — does not reassign ownership.

**Options considered / rejected:**
- `isManager: boolean` flag on `org_unit_members` — rejected; collapses all team-local authority to one bit, conflicts with platform's richer scope enum.
- `team-member` vs `team-manager` as separate scopes — rejected; both have identical visibility, so they're not really different scopes. Manager-ness is a capability question (role), not a scope question.
- `position.kind` enum — rejected after deeper review; the platform already has position scopes, so this would be a parallel primitive.
- Hardcoded role-name checks (`position.name === 'Manager'`) — rejected; breaks on rename.

**Why this is rename-safe:**
- Role display name → cosmetic; logic uses permission slugs.
- Position display name → cosmetic; logic uses scope slugs and sortOrder.
- Permissions and scopes are stable string identifiers.

**First implementation step:** verify the platform's current scope-on-position integration works as documented (position → scope mapping, scope resolver, recursive walk). Close any gaps as platform work _before_ the compliance-specific role seeds land.

---

### Q4 — Task lifecycle statuses, workflow placement, and action gates

**Decision:** Five canonical states — `pending | in_progress | blocked | completed | cancelled` — expressed via the platform workflow engine bound to the base `tasks` entity. Action gates (status-dependent rules on non-status actions) are a separate tiny layer in the tasks package.

**Status semantics:**

| Status | Meaning | Escalates? |
|--------|---------|:----------:|
| `pending` | Generated but no work started; individual may or may not be assigned. | Yes |
| `in_progress` | Someone has picked it up and is actively working. | Yes |
| `blocked` | Work stalled — typically waiting on client input or external dependency. A comment explaining the reason is required when transitioning in. | Yes — due dates don't care why you're stuck; the head of team needs visibility. |
| `completed` | Filing done. `completedAt` stamped automatically. | No |
| `cancelled` | No longer relevant (erroneously generated, scope vanished). Preserved for audit. | No |

**Transitions:**

```
pending ──pickup──→ in_progress ──complete──→ completed
   │                    │   ↕ block/resume        │
   │                    ↓                         │
   │                 blocked ────complete────→ (same)
   │                    │
   └────────cancel──────┴────→ cancelled
                                    ↑  (no un-cancel — use reopen)

completed ──reopen──→ in_progress
cancelled ──reopen──→ in_progress
```

**Options considered and rejected:**
- Three-state (`pending / in_progress / completed`) — no way to distinguish waiting-on-client from actively-working, which is ~60% of slippage in Indian CA practice. Loses a high-signal operational lens for one saved column state.
- Six-state with `filed` between `in_progress` and `completed` — forces a second manual flip per task and splits "done" ambiguously. Deferred until statutory integrations make the distinction meaningful.
- Separate `reopened` status — reopening is a transition, not a resting state; flips to `in_progress`.
- Storing `overdue` as a status — creates drift (forget to flip back). Derived instead: `dueDate < today AND !isTerminal`.
- A compliance-specific `compliance-task-status` workflow on the `compliance_tasks` extension — rejected because the five states are generic enough for any task-kind. One workflow on base `tasks`, shared by all kinds. Future kinds that need different states can override via their extension's `defineEntity()`, bound to the same column.

**Workflow placement:**
- Declared inside `defineEntity()` in `tasks.config.ts` alongside `fields`, `dataAccess`, etc. Same declarative pattern `clients` and `compliance_rules` already use.
- **Not in `onModuleInit()`** — workflow definition is declarative metadata, not a runtime registration. In-memory registrations (action handlers, event subscriptions) remain `onModuleInit`.
- If the workflow package persists definitions to DB, the code declaration drives a system seed (peer-to-migration), mirroring the permission-seeding pattern. Verify during implementation; if the platform only supports in-memory workflow registration today, either is fine.

**Canonical state protection:**
- `completed` and `cancelled` are seeded with `isSystem: true` on the workflow state rows. Admin UI blocks rename/delete on those two.
- Admins may freely **add** states (e.g., insert `filed` between `in_progress` and `completed`) and rename/delete non-system states.
- Rationale: canonical slugs are wired into code (`completedAt` stamping, escalation pause, terminal-state checks in action gates). A silent rename would break those behaviours.
- Alternatives rejected: (a) trusting admins fully → silent breakage on rename; (b) code-only workflow (not persisted) → blocks firms from customising, loses consistency with other entity workflows.

**Action gates (non-status actions, conditional on status):**

| Action | Allowed statuses |
|--------|------------------|
| `pickup` | `pending` |
| `reassign` | `pending`, `in_progress`, `blocked` |
| `review` | `in_progress`, `blocked` |
| `complete` | `in_progress`, `blocked` |
| `reopen` | `completed`, `cancelled` → target state `in_progress` |
| `cancel` | `pending`, `in_progress`, `blocked` |

- Declared per action in the tasks package, alongside the action guards (Stream A).
- Composed with permission + scope on every action: `hasPermission ∧ scopeCheck ∧ status ∈ allowedStatuses`.
- Exposed to the UI via the task DTO (list of allowed actions per task) so buttons can be disabled without hardcoding slugs on the frontend.
- Rejected: modelling these as workflow transitions (`reassign` doesn't change status — it's outside the workflow engine's remit). Rejected: inlining `if` statements in each action handler — spreads the rule, makes it hard to reason about.

**Status-transition guards:**
- Transition-time conditions (e.g., "require a comment when moving to `blocked`", "require ≥1 attachment before `completed`") live inside the workflow definition as transition guards — a platform feature already used by client and rule workflows.

**Why `blocked` still escalates:**
- It's easy to assume blocked = paused, but in compliance, due dates don't care why you're stuck. A blocked task approaching its due date is exactly when escalation should fire — the head of team needs the opportunity to re-chase the client or reassign. Only `completed` and `cancelled` pause escalation.

**UI implications (no hardcoded slugs in generic views):**
- Kanban columns → workflow states, ordered by `sortOrder`.
- "My queue" default filter → `isTerminal: false`.
- Overdue styling → `dueDate < today AND !isTerminal`.
- Disabled action buttons → action gate's `allowedStatuses` exposed via DTO.
- Kind-specific UI nudges (e.g., the "Why blocked?" comment prompt) live in the compliance UI, not the generic tasks UI.

---

### Q5 — Definition of "complete"

**Decision:** In V1, marking a task complete is a **pure status change**. No attachment, no acknowledgement number, no proof requirement. `completedAt` is stamped automatically by the existing `applyCompletedAt` hook when status moves to `completed`.

**Options considered:**
- (a) Status change only. _[chosen]_
- (b) Require ≥1 attachment before `completed`, enforced as a transition guard.
- (c) Require an attachment **and** an acknowledgement identifier (new `ackNumber` text field).
- (d) Allow complete without proof but flag the task as "completed without proof" until an attachment is added.

**Why (a):** Keeping completion a pure status change decouples Stream A (workflow) from Streams F/G (attachments, comments) — the lifecycle can be wired up and tested in isolation. It also matches the MVP principle of shipping the thinnest operational surface: V1 completion is a firm-internal acknowledgement, not an ITD acknowledgement.

**Why not (b)/(c) yet:** The "did we actually file?" assurance belongs with statutory integrations — when the system can pull an ACK number from the ITD / GSTN / TRACES APIs, there's real proof to attach. Until then, requiring an attachment just incentivises users to upload any PDF to unblock the button (compliance theatre). (c) adds schema (`ackNumber`) and UX that will be redesigned once integrations land. Both deferred to the version that introduces filing integrations — likely (c) is the post-V1 target.

**(d) rejected** because it introduces a third derived state that nobody asked for. If firms want visibility into missing-proof tasks, a view that filters `status = completed AND attachment_count = 0` covers it without schema changes.

**Implications for the build plan:**
- No transition guard on `in_progress → completed` beyond what the workflow engine enforces natively (see Q4 for the `blocked` guard).
- Streams F (attachments) and G (comments) remain optional enhancers of the task experience, not prerequisites for completion.
- When statutory integrations arrive (post-V1), revisit: introduce `ackNumber` field, optionally add an intermediate state, and move the hard proof requirement there.

---

### Q6 — Client lifecycle: what happens on dormantisation

**Decision:** When a client transitions `active → dormant`, two things happen as part of the transition:

1. **Auto-cancel all non-terminal tasks for that client.** Every `compliance_task` where `clientId = <client> AND status ∈ {pending, in_progress, blocked}` is flipped to `cancelled`, with a system comment ("Auto-cancelled: client `<Name>` dormantised on `<YYYY-MM-DD>` by `<actor>`."). Captured in audit as a normal write.
2. **Stop generating new tasks for this client.** The task-generation action filters on `client.status = 'active'` — dormant clients are naturally excluded. No future tasks accumulate.

The UI shows a confirmation prompt on transition: _"This will cancel N open tasks. Continue?"_ so the effect is never surprising.

**Options considered:**
- (a) Leave tasks alone; user manually cancels what's no longer relevant.
- (b) Auto-cancel non-terminal tasks + stop future generation. _[chosen]_
- (c) Block the `active → dormant` transition while open tasks exist.
- (d) Move open tasks to a "paused" sub-status; resume if the client reactivates.

**Why (b):** Dormancy in a CA firm means "we've stopped the engagement" — no one on the firm side is filing for this client any more. Leaving tasks active (a) creates ghost work that escalates to team heads and spams digests indefinitely. Blocking the transition (c) makes dormantisation administratively painful, which pushes users to leave dead clients in `active` — the worst outcome. (d) adds a fourth lifecycle state for a rare reactivation path; if a client returns, fresh scoping is typically needed anyway, so "cancel now, regenerate on reactivation" is both simpler and more accurate than pausing.

**Reactivation (`dormant → active`):** Task generation resumes from the reactivation date forward — no backfilling of periods the client was dormant for. Previously auto-cancelled tasks stay cancelled; they represent intentionally-skipped periods and the engagement's new contract decides which obligations apply from now on.

**Relationship to the forward-only principle (Q8):** This is the one place V1 is *not* purely forward-only on deactivation — dormancy proactively cancels existing work. Justification: dormancy is a stronger signal than registration deactivation or rule deprecation. When a client goes dormant, no one at the firm is responsible for their filings any more. When a rule is deprecated or a single registration is deactivated, other clients / other laws may still have valid open work that should be completed. The asymmetry reflects that.

**Implementation ripple (add to Stream C / a new sub-stream):**
- Hook on the `client.status → dormant` workflow transition that enumerates the client's non-terminal tasks and bulk-updates them to `cancelled` with the system comment. Must be transactional with the transition itself.
- Task generator (`GenerateComplianceTasksAction`) to filter out non-`active` clients — verify that this filter is already in place; add if not.
- UI prompt on the transition surfacing the task count and confirmation.

### Q7 — Multiple registrations against the same law

**Decision:** Defer to V2. V1 assumes **one active registration per `(client, law)`**. No schema change from today's `client_registrations`.

**Context:** The common Indian case is GST multi-state — a company with branches in Maharashtra, Gujarat, and Karnataka holds three GSTINs and files GSTR-1 / GSTR-3B independently for each. TDS (TAN) can multiply similarly when a company has multiple deductor identities.

**Options considered:**
- (a) Disallow multiple registrations — the V1 status quo.
- (b) Add `registrationNumber` to `client_registrations`, key tasks on `(rule, registration, period)` so each GSTIN has its own task flow.
- (c) Allow multiple registrations as metadata only; tasks stay keyed at `(client, law)` and the GSTIN is recorded in-task.
- (d) Use **client groups** instead: model each state as its own client record (with its own branch address, contacts, team ownership), group them under the parent business. Pushed out when Q1 deferred groups.

**Why defer:** (b) and (d) are alternate designs for the same problem:
- (b) keeps one client record, adds a per-registration identifier, and couples contacts/team to the parent client.
- (d) creates N client records with independent contacts / team / address; the group gives the roll-up view.

Each has real tradeoffs — (b) is a tighter schema but forces shared contact/team; (d) separates things cleanly but requires the group primitive (deferred in Q1). Making the call without groups in scope risks locking in the wrong shape. Better to revisit both together when Q1 comes back on the table.

**V1 workaround for firms that need multi-state GST today:**
- (i) Track the primary GSTIN as the registration, capture others in task comments or a text field. Unsearchable but survives V1.
- (ii) Create one client record per state manually. Duplicates contacts and loses client-level reporting but gives per-GSTIN task tracking.

Either is acceptable as a known gap. Neither is blocking — most small-firm clients have a single GSTIN, and the firms that need multi-state can self-serve via (ii) until V2.

**Implication for the build plan:** no schema change, no generator change, no UI change. The existing `client_registrations` + `GenerateComplianceTasksAction` keep working as-is.

---

### Q8 — Forward-only semantics on registration deactivation & rule deprecation

**Decision:** Forward-only **from the effective date**, not from the input date. Different specifics for registrations (which have an effective date) and rules (which don't).

**Registration deactivation:**

`client_registrations.deactivatedAt` is **user-selectable**, constrained to **past or present only** in V1 (no future-scheduled deactivation — would require a recurring "process pending deactivations" job for no V1 payoff). Backdating is the common real-world case: clients routinely inform the firm about a GST/TAN cancellation weeks after the fact, and the effective date is what determines which periods were legally active.

On deactivation, tasks are partitioned by `periodStart`:

| Task condition | Action |
|---|---|
| `periodStart > deactivatedAt` AND non-terminal | Auto-cancel with a system comment ("registration deactivated effective YYYY-MM-DD; this period falls after"). These tasks should never have existed. |
| `periodStart ≤ deactivatedAt` AND non-terminal | Leave alone — may still be legally required to file (e.g. the February GSTR-3B is still due even if GST was surrendered on 31-Mar). |
| Terminal (`completed` / `cancelled`) | Untouched regardless. |

Future generation stops naturally via a generator-side filter: `registration.deactivatedAt IS NULL OR registration.deactivatedAt > periodStart`.

**Rule deprecation:**

Rules don't have an effective date the same way — deprecation is simply "stop generating new tasks from this rule." So rule deprecation is **forward-only from now**: already-generated tasks are left alone regardless of period; the generator just skips deprecated rules.

**UI in both cases:**

- On deactivation / deprecation, show a summary before confirming: "Deactivating this registration effective YYYY-MM-DD. M tasks after this date will auto-cancel. N tasks remain open for earlier periods."
- **Optional secondary checkbox:** "Also cancel the N remaining in-flight tasks for earlier periods." Default unchecked. Lets firms who want to abandon everything do it in one action.
- Registration detail / rule detail page afterwards shows a "Deactivated on YYYY-MM-DD" / "Deprecated" banner so the non-generation behaviour is explicit.
- In task list views, tasks linked to a deactivated registration or deprecated rule get a subtle marker so users seeing an unfamiliar task understand its provenance.

**Options considered and rejected:**
- Forward-only from **input date** (ignore the user-selected `deactivatedAt`) — rejected because backdated entries would leave invalid tasks (generated for periods after the real cancellation date) alive indefinitely.
- Auto-cancel *all* non-terminal tasks on deactivation (parallel to client dormancy) — rejected because it destroys valid pre-effective-date obligations. Dormancy is the exception, not the rule; registration/rule deactivation is softer.
- Block deactivation until all tasks are terminal — too harsh, prevents recording the real-world event until tidy-up is done.

**Relationship to Q6:** the three "things can become inactive" transitions now have cleanly distinct semantics — client dormancy (aggressive: cancel all non-terminal); registration deactivation (medium: cancel tasks after effective date, keep earlier); rule deprecation (soft: forward-only, no cancel).

**Implementation ripple (extend Stream I):**
- Hook on `client_registrations` deactivation that partitions tasks by `periodStart` vs. `deactivatedAt` and cancels the post-effective-date set; optional checkbox cancels the remainder.
- Generator filter for registration effective date: `registration.deactivatedAt IS NULL OR registration.deactivatedAt > periodStart`.
- Hook on `compliance_rules.status → deprecated` that only stops generation — no auto-cancel; surface the optional cancel checkbox.
- Generator filter for rule status: already filters on `status = 'active'` (verify during implementation).
- UI on both transitions: date picker (for registration), summary of auto-cancelled tasks, optional checkbox for remainder, deactivation/deprecation banners thereafter.

---

### Q9 — Rule parameter changes mid-period

**Decision:** **Per-field policy.** Cosmetic fields are freely editable; due-date math is editable but forward-only; rule-identity fields become immutable once the rule has generated at least one task.

| Field | Policy | Why |
|---|---|---|
| `name`, `description` | Freely editable | Cosmetic, no functional impact. |
| `dueDayOfMonth`, `dueMonthOffset`, `gracePeriodDays` | Editable, forward-only | New values apply to newly-generated tasks. Already-generated tasks keep their original due dates. Silently moving the due date on tasks that are already on dashboards, in digests, and being worked against would break user trust and invalidate overdue calculations mid-flight. |
| `code` | Immutable once ≥1 task generated | The natural key downstream; renaming would orphan historical references. |
| `frequency` (monthly / quarterly / …) | Immutable once ≥1 task generated | Changing frequency means a different rule conceptually — user should deprecate and create a new rule. |
| `lawId` | Immutable once ≥1 task generated | Changes what law the tasks are filed under — rewrites history. |
| `status` (draft / active / deprecated) | Workflow-managed | Covered by Q8 for `deprecated`; `draft → active` is the initial activation transition. |

**Options considered and rejected:**
- Forward-only from edit time (universal) — right for due-date math, wrong for identity fields where even new tasks shouldn't be under a renamed `code` or shifted `lawId`.
- Recompute all non-terminal tasks on any edit — destructive; shifts deadlines on tasks being worked against, breaks the overdue signal retroactively.
- Block all edits once ≥1 task generated — punishes legitimate corrections (typo in `dueDayOfMonth`, clearer description) by forcing a deprecate-and-recreate dance.

**Idempotency interaction:** the generator's natural key is `(ruleId, registrationId, periodStart)` (with Q7 deferred, effectively `(ruleId, clientId, periodStart)` in V1). On key conflict during a sweep, the generator is a **pure no-op** — never mutates an existing row. This keeps forward-only strict: fixing a mistake on an already-generated task requires the user to cancel it explicitly, at which point the next generator sweep emits a fresh row using the current rule parameters.

**UI communication:**
- Immutable fields are disabled in the edit form once the rule has generated tasks, with a tooltip: "Cannot change — this rule has generated tasks. Deprecate this rule and create a new one to change `<field>`."
- Editing a forward-only field (due-date math): save dialog shows "This change will apply only to tasks generated from now on. N tasks already generated will keep their current due dates."
- No "recompute in-flight tasks" bulk action in V1.

**Edge case — long-horizon tasks pre-edit:** a task generated months in advance (in the 6-month horizon) will now have older math than the current rule. Fine — it stays with original due date. If the user wants the new math applied, they cancel it and the next sweep regenerates against the new parameters.

**Implementation ripple (extend Stream I):**
- Guard on rule update that enforces the immutability of identity fields once ≥1 task exists.
- "Has this rule generated any task?" helper on the service layer — a simple `SELECT 1 FROM compliance_tasks WHERE rule_id = ? LIMIT 1`.
- UI logic in the rule edit form to disable immutable fields, and the save dialog copy for forward-only edits.

---

### Q10 — Weekend / public-holiday handling on due dates

**Decision:** Calendar date as-is. No holiday calendar in V1. Firms that want a cushion for weekend / holiday ends express it through the existing `gracePeriodDays` field on the rule.

**Options considered:**
- (a) Calendar date as-is. _[chosen]_
- (b) Auto-roll to next working day (store rolled date).
- (c) Store `statutoryDueDate` + `workingDueDate` separately.
- (a) + (d) grace period absorbs the shift — no schema change. _[chosen, naturally]_

**Why (a):** statutory due dates are the actual calendar dates in Indian compliance. ITD / GSTN portals are automated and accept filings on weekends and public holidays, so the legal due date never shifts. "Next working day" rolling is a firm-internal convenience, not a statutory requirement.

**Why not (b):** requires a state-wise gazetted holiday calendar (Republic Day is nationwide but Maharashtra Day isn't), dragging in multi-state complexity V1 has deferred. Also silently shifts dates users know by muscle memory ("11th is GSTR-1"), breaking trust.

**Why not (c):** adds a column, a second date to communicate in UI / emails / escalation, and raises "which date does overdue fire against?" — all for marginal gain when (d) covers the need via an existing field.

**How `gracePeriodDays` covers the case:** a firm that wants "due on the 11th, but don't escalate if filed by Monday" sets `gracePeriodDays = 2` on that rule. Overdue calc is `today > dueDate + gracePeriodDays`, so weekend-end due dates get a quiet buffer without the system needing to know *why*.

**Explicit V1 limitation (documented, not fixed):** the system has no concept of public holidays. A due date on Diwali is treated like any other calendar date. Firms handle it via `gracePeriodDays`. A working-day math + holiday calendar is a post-V1 feature if customer demand materialises.

**Implication for build:** zero schema change, zero generator change, zero UI change beyond rendering the stored date. No new Stream I tasks.

### Q11 / Q12 — Task generation horizon & trigger

**Decision:** Rolling **12-month** horizon based on `periodStart`, refreshed by a **daily cron** and top-up **event-driven** on rule / registration / client-activation creation.

**Horizon:** 12 months forward from today, measured by `periodStart` (not `dueDate`). So on any given day, the system has materialised every `(active rule × active registration)` task whose period begins within the next 12 months. This gives yearly rules (e.g. the ITR for FY26-27 with `periodStart = 2026-04-01`) exactly 12 months of prep lead time — visible from 2025-04-01 — while keeping monthly/quarterly rules comfortably in view.

**Triggers:**

| Event | What generates |
|---|---|
| Daily cron sweep | For every `(active rule × active registration)` pair, fill any missing task rows for `periodStart ∈ [today, today + 12mo]`. Idempotent: existing rows are no-ops. |
| Rule activated (`status` → `active`) | Generate for this rule × all its active registrations, full horizon. Immediate visibility — no waiting for the next sweep. |
| Registration created | Generate for all active rules on that law × this registration, full horizon. |
| Client reactivated (`status` → `active`) | Generate for all active registrations of this client × active rules, full horizon. (Previously cancelled tasks from the prior dormancy stay cancelled per Q6.) |

**Why rolling rather than FY-aligned:**
- More forgiving for firms onboarding mid-year — they see 12 months forward from day one, not "next year becomes visible in March."
- No brittle "big batch" moment — a failed yearly batch on 1st March would leave a whole FY unmaterialised until the daily safety-net catches it. With rolling + daily, the safety-net *is* the primary mechanism.
- Idempotency means daily sweep cost is negligible (mostly no-op key conflicts per Q9).

**Why 12 months specifically:**
- Long enough for yearly-rule prep lead time (ITR, tax audit, Form 3CD).
- Short enough to keep row count sane — roughly `(active rule-registration pairs) × ~13 rows / year` for monthly rules.
- Matches how firms talk about their work calendar ("what's coming up this year").

**Options considered and rejected:**
- Keep 6 months (current code) — yearly filings wouldn't appear until ~6 months before due, too late for prep chasing.
- FY-aligned annual batch on 1st March + safety-net sweep (Model B) — aesthetically appealing but introduces a brittle moment and privileges mid-year onboarders less well.
- Per-rule horizon (monthly rules = 3mo, yearly = 24mo) — over-engineered; marginal UX gain for real per-rule config complexity.
- Per-firm configurable horizon (settings) — ship the right default; offer knob in V2 if asked.

**Concrete timeline for FY 2026-27 tasks under the locked model:**
- **2025-04-01:** FY26-27 yearly ITR + April 2026 GSTR-1 first become visible (exactly 12 months ahead of their `periodStart`).
- **2025-04-01 → 2026-03-01:** monthly / quarterly FY26-27 tasks roll into view progressively as each period's start enters the 12-month window.
- **2026-03-01:** nearly all FY26-27 tasks visible; any with `periodStart` in the tail end of March 2027 enter on exactly 2026-03-01.

**Implication for build:** the existing `GenerateComplianceTasksAction` stays as the core engine. Changes needed: extend horizon 6→12 months; wire a daily schedule trigger; subscribe to the three domain events for event-driven generation.

---

### Q13 — Missing handler behaviour

**Decision:** Prevent the missing-handler state at write time via a **first-registration guard**. The 4-tier resolver is then guaranteed to return a non-null team at task generation. No fallback team, no synthetic "Unassigned" bucket, no NULL `assigneeTeamId`.

**Three guards together maintain the invariant:**

1. **First-registration guard.** When creating a `client_registration` for a `(client, law)` pair, if no `law_handlers` row exists for that `(firm, law)` combination (global-primary or global-any), block the create and surface an inline prompt: _"No handler configured for `<Law>`. [Configure handler] or cancel."_ The "Configure handler" link deep-links into the handler admin page scoped to that law.

2. **Handler-delete guard.** Deleting a `law_handlers` row is blocked if it would leave any active client registration for that law without a resolvable handler. Admin must add the replacement handler *before* deleting the existing one.

3. **Org-unit-delete cascade.** Deleting an `org_unit` that's referenced by any `law_handlers` row forces the admin to reassign each reference first. Same "replace before delete" pattern.

**Why first-registration, not law-creation:**
- Covers **both** user-created laws AND system-seeded laws (GST, Income Tax, TDS) that the firm hasn't "created" but is using.
- Doesn't front-load law creation — firms can enumerate their law catalogue in one session and structure their teams later.
- Single invariant boundary rather than scattered creation-time checks.

**Options considered and rejected:**
- Fallback to a firm-level "Unassigned" team when the resolver returns null — risks silent misrouting; tasks pile up in a team nobody checks. Works, but tolerates misconfiguration rather than preventing it.
- Fallback to a platform-level synthetic team — pollutes the org hierarchy with a team the firm didn't create; breaks escalation and multi-tenancy assumptions.
- Block at law creation only — misses system-seeded laws and doesn't protect against later handler/org-unit deletion.
- Fail-soft with `assigneeTeamId = NULL` — contradicts Q2's NOT NULL invariant.

**Parallel to existing patterns:** mirrors the existing primary-contact guard on the `client.status → active` transition. Same philosophy: validate the precondition at the transition, don't rely on a silent fallback.

**Edge case — admin mid-reassignment of handlers:** the delete-before-add workflow is blocked by guard #2. Admin must add the new handler first, then delete the old. Small UX friction for a clean invariant.

**Implementation ripple (extend Stream I):** three new guards (registration create, handler delete, org unit delete), the inline "configure handler" deep-link in the registration creation UI, and service-layer helpers to check resolver coverage.

---

### Q14 — Scope → position mapping at seed time

### Q14 — Scope → position mapping at seed time

**Decision:** Five seeded positions, scopes seeded **only for task entities** in V1. Other compliance entities get their scope seeding deferred until their respective feature work.

**Seeded positions (all admin-editable display names, stable internal identifiers):**

| Position | sortOrder | Task-entity scope |
|---|---|---|
| Member | 2 | `unit` |
| Lead | 1 | `unit` |
| Head | 0 | `unit` |
| Division Head | 0 (on a division-level unit) | `descendants` |
| Firm Admin | -1 or lowest | `all` |

Scope seeds apply to `tasks` and `compliance_tasks` only. Other compliance entities (`clients`, `client_registrations`, `client_contacts`, `compliance_rules`, `laws`, `law_handlers`) get **no seeded (position, entityType) rows** in V1.

**Platform scope semantics** (verified in `packages/addons/org-units/api/services/position-scope-resolver.service.ts:17–19`):
- `own` → only the user's own records (`[userId]`).
- `unit` → all users in the user's direct units (team-level visibility).
- `descendants` → user's units + all descendant units, recursive CTE.
- `all` → unfiltered.
- Fail-closed default (line 47): when no position/scope row exists for a `(user, entityType)`, the resolver returns `own`.

**Task entities get extra team-visibility via `teamField`:** the tasks entity config unions `assigneeTeamId` into the owner check, so even `own` scope on tasks effectively shows "me OR tasks owned by teams I'm in." Doesn't apply to entities without a configured `teamField`.

**Why seed only tasks:**
- Task visibility is the V1 scope's operational heart — every seeded role's capability check depends on it.
- Other entities (clients, rules, laws) have different visibility models across typical CA firms — some want clients firm-wide, some team-segregated. Making the call without feature-specific need is premature.
- Fail-closed default `own` for non-task entities will likely need attention when we wire the clients and rule catalogue list pages — at that point we decide per-entity (seed `all`, seed `unit`, or add an entity-level `defaultScope` mechanism). Not urgent for V1 task lifecycle work.

**Options considered and rejected:**
- Seed the same `unit / descendants / all` scopes across every compliance entity preemptively — premature; assumes team-segregated visibility applies uniformly, which isn't obvious for catalogue-style entities.
- Seed only two positions (Head + Member) — Lead is a meaningful middle tier in many firms; seeding all three avoids common customisation.
- Omit Division Head and Firm Admin seeds — firms with hierarchy or firm-level admins would have to custom-create them; seeding keeps a fresh install usable for multi-level firms too.

**UX flag (non-blocking) — role/position tier mismatch:** because role (capability) and position (structure) are orthogonal per Q3, a Member holding the Team Lead role effectively has team-leadership capability in their team despite not being structurally a Head. The admin UI surfaces a warning when assigning a leadership-tier role to a non-leadership position, but permits it. Feature, not bug.

**Implementation ripple (extend Stream C):**
- Seed the five positions with stable internal identifiers.
- Seed `(position × task-entity)` scope rows: 5 positions × 2 task entities (base tasks + compliance_tasks) = 10 rows.
- UI warning on role assignment when role-tier ≠ position-tier.

---

### Q15 — Role ↔ permission seed composition

**Decision:** Four seeded roles with admin-editable display names and permission sets. Task permissions from the `tasks` package; compliance-entity CRUD permissions auto-generated by entity-engine.

**Task permissions:**

| Permission | Preparer | Reviewer | Team Lead | Firm Admin |
|---|:-:|:-:|:-:|:-:|
| `tasks.view` | ✅ | ✅ | ✅ | ✅ |
| `tasks.pickup` | ✅ | ✅ | ✅ | ✅ |
| `tasks.reassign` |  |  | ✅ | ✅ |
| `tasks.review` |  | ✅ | ✅ | ✅ |
| `tasks.complete` | ✅ | ✅ | ✅ | ✅ |
| `tasks.reopen` |  |  | ✅ | ✅ |
| `tasks.close` |  |  | ✅ | ✅ |

**Compliance-entity permissions:**

| Permission | Preparer | Reviewer | Team Lead | Firm Admin |
|---|:-:|:-:|:-:|:-:|
| `compliance.clients.view` | ✅ | ✅ | ✅ | ✅ |
| `compliance.clients.create` / `.update` |  |  | ✅ | ✅ |
| `compliance.clients.delete` |  |  |  | ✅ |
| `compliance.client_contacts.view` | ✅ | ✅ | ✅ | ✅ |
| `compliance.client_contacts.create` / `.update` / `.delete` |  |  | ✅ | ✅ |
| `compliance.client_registrations.view` | ✅ | ✅ | ✅ | ✅ |
| `compliance.client_registrations.create` / `.update` |  |  | ✅ | ✅ |
| `compliance.client_registrations.delete` |  |  |  | ✅ |
| `compliance.laws.view` | ✅ | ✅ | ✅ | ✅ |
| `compliance.laws.create` / `.update` / `.delete` |  |  |  | ✅ |
| `compliance.compliance_rules.view` | ✅ | ✅ | ✅ | ✅ |
| `compliance.compliance_rules.create` / `.update` |  |  | ✅ | ✅ |
| `compliance.compliance_rules.delete` |  |  |  | ✅ |
| `compliance.law_handlers.*` |  |  |  | ✅ |

**Rationale by role:**

- **Preparer** — rank-and-file worker. Reads everything for context; acts only on their own tasks (pickup + complete). No review, reassign, reopen, close. No data-steward writes.
- **Reviewer** — Preparer + `tasks.review`. Review is informational in V1 (no maker-checker gate per Q5) but a distinct capability firms assign selectively.
- **Team Lead** — full task lifecycle + write access to clients, contacts, registrations, and rules (subject to Q9's per-field rule edit policy). No deletes, no law-catalogue writes, no `law_handlers` — those are firm-admin territory.
- **Firm Admin** — everything. Sole holder of deletes, law creation/update/delete, and `law_handlers` (which governs task-generation routing per Q13).

**Deliberate omissions:**
- No law write below Firm Admin — shared catalogue integrity.
- No client / registration delete below Firm Admin — deactivation (Q8) is the normal lifecycle; hard-delete is exceptional.
- No `tasks.reassign.any` / `.reopen.any` super-variants — Firm Admin's `all` scope (per Q14) already grants firm-wide reach, so parallel permission surfaces are redundant.

**Options considered and rejected:**
- Merge Preparer + Reviewer into one role — rejected; review is a distinct capability firms want to grant selectively (senior preparer signs off on juniors' work without running the whole team).
- Grant Reviewer `tasks.reassign` — rejected; reassign is team management, distinct from review-chain.
- Grant Team Lead deletes — rejected; deletes are destructive and firm-wide; admin-gating keeps blast radius small.
- Ship without Firm Admin — rejected; every firm needs at least one super-user for initial setup and handler config.

**Implementation ripple:** no new tasks — the permission set is already covered by Stream C's C1 (role system seed). The table above becomes the source of truth for that seed.

---

## 2. Pending decisions

Questions still to work through before we can finalise V1 implementation. Answered one by one; each is moved into §1 on resolution.

### Q16 — Multi-team visibility

### Q16 — Multi-team visibility
An employee in Teams A and B, task assigned to Team A: should they see it in their personal "all my tasks" view, or only inside Team A's board?

### Q17 — Daily digest send time
Fixed 9am IST, 9am in user timezone (falling back to `APP_TIMEZONE`), or admin-configurable?

### Q18 — Digest content split
"Due within 7 days" and "Overdue" — split further into today / this week / overdue, or keep two sections?

### Q19 — Per-task overdue email frequency
Once on the day a task becomes overdue, every day it stays overdue, or only at escalation milestones (T+0, T+3, T+7)?

### Q20 — Notification target when no individual assignee
Digest to every team member, or only to team head(s)?

### Q21 — User opt-out of notifications
Allowed in V1 (per-channel / per-rule), or everyone on by default with no opt-out?

### Q22 — Audit scope
Writes only, with field-level before/after diffs? Or also read-auditing of sensitive fields? What does the platform's audit infrastructure support out of the box?

### Q23 — Audit visibility
Who can view the audit trail — firm admins only, or also team leads / task stakeholders for their own scope?

### Q24 — Sensitive field redaction
List of fields to redact in audit logs. Candidate list: `clients.taxId` (PAN/GSTIN), contact email, contact phone. Anything else?

### Q25 — Audit retention
Keep forever in V1, or define a purge policy?

### Q26 — Attachment file-type whitelist
Candidate: PDF, PNG, JPG, XLSX, XLS, DOCX, DOC. Add ZIP / CSV? Block executables explicitly?

### Q27 — Attachment max size
25 MB per file? Per-task cap? Any storage quota per firm / client?

### Q28 — Attachment retention
Keep forever in V1, or purge on task close + N days?

### Q29 — Comment mutability
Flat comments; editable by author anytime, within N minutes, or immutable? Delete policy?

### Q30 — Comment @mentions and notifications
Support `@user` mentions that generate a notification in V1, or defer?

### Q31 — Leave modelling
Boolean `onLeave` on user, date-range `leaveSince` / `leaveUntil`, or full time-off module (defer)? Affects how the system nulls `assigneeId` while someone is away.

### Q32 — Termination behaviour
On termination, null `assigneeId` on all their open tasks AND remove from team memberships? Or keep membership and only null task assignments? Who does this — admin action, or auto on user deactivation event?

---

## 3. Build task list

Derived from §1. Re-estimated and re-ordered whenever §1 grows. Each bullet is intended to be one commit; siblings can be bundled into one PR at natural package seams per the worktree / PR rules.

> Legend: `[ ]` not started · `[~]` in progress · `[x]` done.

### Stream A — Tasks package hardening (platform-level, no compliance deps)

- [ ] **A1.** Drop the XOR constraint (`validateAssigneeExclusivity` in `tasks.config.ts:8` and the swap logic at `:107–113`). Tighten `assigneeTeamId` to `NOT NULL` via migration. After this, a task must always have a team and may optionally have an individual — both can coexist. (Q2)
- [ ] **A2.** Define task action permission slugs (`tasks.view`, `tasks.pickup`, `tasks.reassign`, `tasks.review`, `tasks.complete`, `tasks.reopen`, `tasks.close`) as constants in the tasks package. (Q3)
- [ ] **A3.** Add a system seed in the tasks package that upserts these permissions into the permission registry. Wire into the CLI's system-seed run. (Q3)
- [ ] **A4.** Add action-level guards / service methods: `pickupTask`, `reassignTask`, `reviewTask`, `markComplete`, `reopenTask`, `closeTask`. Each enforces permission + scope + task-relationship (assignee / team member / head) checks. (Q3)
- [ ] **A5.** Expose the new action endpoints in the tasks controller with proper DTOs. Include each task's list of currently-allowed actions in the list/get response so the UI can disable buttons without hardcoding status slugs. (Q3, Q4)
- [ ] **A6.** Verify scope-on-position integration end-to-end (position → scope, scope resolver, descendants walk). Close gaps _in the org-units / rbac packages_, not in the tasks package. (Q3 — "first implementation step")
- [ ] **A7.** Define the task lifecycle workflow on the base `tasks` entity in `tasks.config.ts` via `defineEntity()`. Five states (`pending / in_progress / blocked / completed / cancelled`), transitions per §1 Q4, transition guards (`blocked` requires a reason comment). Mark `completed` and `cancelled` states with `isSystem: true` so they cannot be renamed or deleted via the admin UI. If the workflow package persists definitions, wire a system seed in the tasks package. (Q4)
- [ ] **A8.** Add the per-action `allowedStatuses` configuration (action gate) alongside the action guards from A4. Compose the gate with permission + scope on every action entry point. (Q4)

### Stream B — Escalation subsystem (platform-level, consumes tasks package)

- [ ] **B1.** Define an escalation-target resolver: given a task, return the set of user IDs for tier T+0, T+3, T+7, with fallback rules (roll up, firm admin). (Q3)
- [ ] **B2.** Scheduled job (cron) that sweeps tasks daily, evaluates escalation tier based on due date, and triggers notifications via the notifications package. (Q3, pending Q17/Q19)
- [ ] **B3.** Idempotency — record which tier a task has already notified at; never double-send.

### Stream C — Compliance domain role, position & scope seeds

- [ ] **C1.** System seed: default roles (Preparer, Reviewer, Team Lead, Firm Admin) with the permission sets defined in the Q15 tables (task permissions + compliance-entity CRUD permissions). Added to `complianceSystemSeedSources()` in `domains/compliance/api/seeds.ts`. (Q3, Q15)
- [ ] **C2.** Demo seed: sample user ↔ role assignments reflecting a realistic small firm. (Q3)
- [ ] **C3.** System seed: five default positions with stable internal identifiers — Member (sortOrder 2), Lead (1), Head (0), Division Head (0, used on division-level units), Firm Admin (lowest sortOrder). Display names admin-editable. (Q14)
- [ ] **C4.** System seed: `(position × task-entity)` scope rows for both the base `tasks` entity and the `compliance_tasks` extension. Member/Lead/Head → `unit`, Division Head → `descendants`, Firm Admin → `all`. 10 rows total. No scope seeds for non-task entities in V1. (Q14)
- [ ] **C5.** UI warning on role assignment when the assigned role's tier and the user's position tier don't align (e.g. Team Lead role on a Member position). Non-blocking advisory. (Q14)

### Stream D — Notifications wiring for compliance due dates

- [ ] **D1.** Automation rule / scheduled job for the daily digest — per-user mail with "due within 7 days" + "overdue" sections. (Pending Q17/Q18/Q20)
- [ ] **D2.** Per-task email on day task becomes overdue. (Pending Q19)
- [ ] **D3.** Notification target resolution — assignee if set, else team members; respects escalation recipients from Stream B. (Pending Q20)

### Stream E — Audit trail wiring

- [ ] **E1.** Register each compliance entity (clients, client_contacts, client_registrations, laws, compliance_rules, compliance_tasks, law_handlers) with `AuditRegistryService`. (Pending Q22)
- [ ] **E2.** Define `Snapshot` interfaces + `toSnapshot()` methods on each service. (Pending Q22)
- [ ] **E3.** Configure `sensitiveFields` for each entity (PAN etc.). (Pending Q24)
- [ ] **E4.** Wire audit-trail view in the UI, visibility-gated per Q23.

### Stream F — Attachments on compliance tasks

- [ ] **F1.** Wire the `attachments` addon API/UI on compliance task detail (using generic `entityType='tasks'`, no new table). (Pending Q26/Q27/Q28)
- [ ] **F2.** Enforce file-type whitelist + size limit at upload.

### Stream G — Comments on compliance tasks

- [ ] **G1.** Wire the `notes` addon API/UI on compliance task detail, flat model. (Pending Q29)
- [ ] **G2.** (Conditional on Q30) `@mention` detection + notification on comment create.

### Stream H — Employee lifecycle handling

- [ ] **H1.** Null `assigneeId` on all open tasks of a terminated / deactivated user; surface "unassigned in my team" list for team heads. (Pending Q32)
- [ ] **H2.** Leave tracking — model per Q31. (Pending Q31)

### Stream I — Domain lifecycle transition hooks

Hooks that fire when a client, registration, or rule changes state in a way that affects compliance tasks. Three deactivation paths, three different semantics (see Q6, Q8).

**Client dormancy (aggressive: cancel everything):**

- [ ] **I1.** Hook on the `client.status → dormant` workflow transition that bulk-cancels all non-terminal `compliance_tasks` for the client, attaching a system comment (`"Auto-cancelled: client <Name> dormantised on <date> by <actor>"`). Transactional with the transition. (Q6)
- [ ] **I2.** Ensure `GenerateComplianceTasksAction` filters on `client.status = 'active'`. Verify if already present; add if not. (Q6)
- [ ] **I3.** UI prompt on the dormancy transition showing the number of tasks that will be cancelled, with an explicit confirmation. (Q6)

**Registration deactivation (medium: cancel post-effective-date, keep earlier):**

- [ ] **I4.** Allow user-selectable `deactivatedAt` on `client_registrations`, constrained to past or present only in V1. Add UI date picker with constraint. (Q8)
- [ ] **I5.** Hook on registration deactivation that auto-cancels non-terminal tasks where `periodStart > deactivatedAt`, with a system comment referencing the effective date. Leaves earlier-period tasks alone. (Q8)
- [ ] **I6.** Generator filter: `registration.deactivatedAt IS NULL OR registration.deactivatedAt > periodStart`. (Q8)
- [ ] **I7.** UI on registration deactivation: show summary ("M tasks after this date will auto-cancel; N tasks remain open for earlier periods") plus an optional secondary checkbox to also cancel the N remaining. Default unchecked. (Q8)

**Rule deprecation (soft: forward-only, no auto-cancel):**

- [ ] **I8.** Hook on `compliance_rules.status → deprecated` that stops future generation but leaves existing tasks untouched. No mandatory cancel. (Q8)
- [ ] **I9.** Generator filter: skip rules with `status = 'deprecated'`. Verify if already in place; add if not. (Q8)
- [ ] **I10.** UI on rule deprecation: summary of non-terminal tasks for that rule, plus an optional checkbox "Also cancel N in-flight tasks from this rule." Default unchecked. (Q8)

**Rule parameter edits (per-field policy, forward-only where applicable):**

- [ ] **I13.** Service-layer helper `ruleHasGeneratedTasks(ruleId)` — single-row existence check on `compliance_tasks`. (Q9)
- [ ] **I14.** Guard on rule update that blocks changes to `code`, `frequency`, `lawId` once `ruleHasGeneratedTasks` returns true. (Q9)
- [ ] **I15.** UI in the rule edit form: disable immutable fields with the explanatory tooltip; show forward-only save-dialog copy when due-date-math fields change. (Q9)
- [ ] **I16.** Confirm generator is a pure no-op on `(ruleId, clientId, periodStart)` conflict (never mutates existing row). Add a test if missing. (Q9)

**Handler integrity guards (prevent missing-handler state):**

- [ ] **I19.** Service helper `hasResolvableHandler(firmId, lawId, clientId?)` — checks whether the 4-tier resolver would return a team for the given (firm, law, optional client). (Q13)
- [ ] **I20.** Guard on `client_registrations` create: reject if `hasResolvableHandler(firm, law)` is false. Error response carries the lawId so UI can deep-link to handler config. (Q13)
- [ ] **I21.** Guard on `law_handlers` delete: reject if any active `client_registration` for that law would be left without a resolvable handler after removal. (Q13)
- [ ] **I22.** Guard on `org_units` delete: reject if any `law_handlers` row references the unit. Requires admin to reassign handlers first. (Q13)
- [ ] **I23.** UI on registration creation: inline "Configure handler" prompt when guard #I20 fires; deep-link to the handler admin page scoped to the specific law. (Q13)

**Cross-cutting UI:**

- [ ] **I24.** Banners on client / registration / rule detail pages reflecting their inactive state ("Deactivated on YYYY-MM-DD", "Deprecated", "Dormant"). (Q6, Q8)
- [ ] **I25.** Subtle marker on task rows whose source registration or rule is inactive, so users viewing a task queue understand why an unfamiliar task is there. (Q8)

### Stream J — Task generation cadence

Ensures the generator runs at the right times and produces the right horizon. Builds on the existing `GenerateComplianceTasksAction`.

- [ ] **J1.** Extend the generator horizon from 6 months to **12 months** based on `periodStart`. (Q11)
- [ ] **J2.** Daily cron / scheduled trigger that invokes the generator across every `(active rule × active registration)` pair. Idempotent — per Q9 the generator is a pure no-op on key conflict. (Q12)
- [ ] **J3.** Event subscriber on rule activation (`status → active`): trigger the generator for that rule × all its active registrations, full horizon. (Q12)
- [ ] **J4.** Event subscriber on registration creation: trigger the generator for that registration × all active rules on its law, full horizon. (Q12)
- [ ] **J5.** Event subscriber on client reactivation (`status → active`): trigger the generator for that client's active registrations × active rules. Previously cancelled dormancy tasks remain cancelled per Q6. (Q12)

### Stream Z — Finalisation

- [ ] **Z1.** Update `specs.md` and `todos.md` as decisions evolve — keep in sync.
- [ ] **Z2.** Audit pass (supervisor agent) after all streams merged: naming consistency, no domain logic leaked into packages, no addon → addon imports, test coverage, docs drift.

---

## Notes for future sessions

- Every stream above is a candidate for one or more feature branches; respect the worktree rule (`.claude/rules/use-worktrees.md`) and the one-PR-per-feature / one-commit-per-task rule.
- When a question in §2 is answered, (a) move it to §1 with reasoning, (b) unblock the dependent tasks in §3 by removing the "(Pending Qxx)" marker, and (c) commit the docs change on the same branch as the implementation it unblocks — not in a separate docs-only PR — so progress and decision history move together.
- If a new question surfaces during implementation, stop and add it to §2. Do not decide unilaterally.
