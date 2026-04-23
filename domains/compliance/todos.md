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

### Q16 — Multi-team visibility

**Decision:** "My tasks" = personally-assigned tasks **plus** unassigned tasks in any of the user's teams. Actively-owned-by-teammates tasks stay in the team board, not in the personal queue.

**Default "my tasks" query:**
```
WHERE assigneeId = :me
   OR (assigneeId IS NULL AND assigneeTeamId IN :myTeams)
```

**Team boards** (per-team view, not personal) show all tasks with `assigneeTeamId = team`, regardless of assignee.

**Options considered:**
- (a) Strictly personal — only `assigneeId = me`. Rejected: members who skip the team board miss unassigned tasks drifting toward due date, which defeats the team-first model from Q2.
- (b) Everything in my teams — `assigneeId = me OR assigneeTeamId IN myTeams`. Rejected: for a 10-person team the personal queue fills with teammates' active work; signal/noise drops, team board becomes redundant.
- (c) Personal + unassigned-in-my-teams. _[chosen]_ Balances personal focus with team coverage visibility.

**Edge cases handled naturally:**
- Pickup of unassigned task → `assigneeId = me` → task stays in my queue, no longer classified as unassigned for teammates. Team board still shows it under my name.
- Reassignment to teammate → task leaves my queue, enters theirs.
- Leave / termination per Stream H → `assigneeId` cleared → task appears as unassigned in every teammate's queue in the same team. Intended coverage behaviour.

**Implication for build:** no new schema. The `my-tasks` custom scope in `packages/addons/tasks/api/tasks.config.ts:122–135` currently returns the broader (b) set — update its SQL to the narrower (c) expression. Applies to both the base tasks entity and `compliance_tasks` via extension.

---

### Q17 — Daily digest send time

**Decision:** Digest fires once a day at **9am in `APP_TIMEZONE`** (currently `Asia/Kolkata`), expressed via `cronForLocalHour(9, APP_TIMEZONE)` from `@packages/common`. No per-user timezone resolution in V1.

**Options considered:**
- (a) Fixed 9am in `APP_TIMEZONE`. _[chosen]_
- (b) 9am in each user's timezone with `APP_TIMEZONE` fallback — rejected: V1 users are realistically all in India; adds per-user cron resolution complexity for no current payoff.
- (c) Firm-admin-configurable send time — defer until firms ask.
- (d) Admin-configurable with per-user override — maximum config surface, premature.

**Why `APP_TIMEZONE` rather than hard-coding IST:** uses the platform's timezone primitive correctly. If an install is deployed for a firm in a different timezone (say a V2 deployment in UAE with `APP_TIMEZONE = Asia/Dubai`), the digest naturally shifts — no code change.

**Edge cases:**
- User physically abroad on a given day — digest still fires at 9am IST, lands at an off-hour in their local time. Acceptable for V1.
- Digest generation failure on a given day — next day's run proceeds independently; missed day is gone. Not a blocker because the T+0 / T+3 / T+7 escalation (Stream B) still surfaces urgent work.

**Implication for Stream D:** D1 uses `cronForLocalHour(9, APP_TIMEZONE)` for the schedule trigger. No per-user variance, no additional state.

---

### Q18 — Digest content split

**Decision:** Three sections in the daily digest — **Overdue**, **Due today**, **Due this week** (next 7 days excluding today).

**Rendering rules:**
- Order top-to-bottom: Overdue → Due today → Due this week (most-urgent first to drive action).
- Sections with zero tasks are omitted from the email.
- When all three sections are empty, **no digest is sent** that day (avoids daily empty-inbox noise).
- Within each section, sort by `dueDate` ascending, then by client name.

**Options considered:**
- (a) Two sections ("Due within 7 days" + "Overdue") — rejected: buries today's work in a week-long list, kills the intended nudge.
- (b) Three sections (Overdue / Due today / Due this week). _[chosen]_
- (c) Four sections (Overdue / Today / This week / Next week) — rejected: "next week" and "this week" blur when digest fires mid-week; marginal value for the extra row.
- (d) Flat list sorted by due date — rejected: loses triage framing; reader has to scan to find what's actionable today.

**Edge cases:**
- Tasks escalating that day (T+3 / T+7) — still appear in "Overdue"; escalation notices are separate emails, not part of the digest (see Stream B).
- Task completed between digest generation and send — safe: digest reflects state at generation time; no per-task dedup needed for V1.
- Weekend digest — still fires at 9am Saturday/Sunday in V1. Defer weekend suppression until firms ask.

**Implication for Stream D:** digest generator queries split into three date-range buckets relative to `todayInTimezone(APP_TIMEZONE)`. Template has conditional rendering per section.

---

### Q19 — Notification cadence, ownership, and kind-agnosticism

Consolidated decision covering four sub-questions: cadence, where the rules are defined, priority segmentation, and how the kind discriminator interacts with rule selection.

#### Q19a — Per-task overdue cadence

**Decision:** Three-tier escalation: **T+0, T+3, T+7**. Three emails max per task. No daily-while-overdue spam; daily digest (Stream D) still surfaces the task every morning.

**Options considered:**
- (a) T+0 only — rejected: nothing reaches division heads.
- (b) T+0 / T+3 / T+7 milestones. _[chosen]_
- (c) Every day overdue — rejected: inbox fatigue, users tune it out.
- (d) Milestones + weekly thereafter — rejected: digest already provides daily visibility post-T+7.

Tiers match Q10 escalation semantics: T+0 to assignee (or team members if unassigned); T+3 to team head; T+7 to parent-unit head.

#### Q19b — Ownership and mechanism

**Decision:** Notifications flow entirely through the existing **automations** primitive. No parallel cron, no hardcoded listeners. `packages/addons/tasks` owns the seed set so every tasks-using domain inherits notifications for free.

**Tasks package ships 4 system-seeded automation rules:**

| Seed rule | Trigger | Entity | Action | User resolution |
|---|---|---|---|---|
| `task-overdue-tier-1` | `schedule_recurring`, `dueDate + 0 days` | `tasks` | `send_notification` | `entity_field(assigneeId)` OR `org_unit_members(assigneeTeamId)` if assignee null |
| `task-overdue-tier-2` | `schedule_recurring`, `dueDate + 3 days` | `tasks` | `send_notification` | `org_unit_head(assigneeTeamId)` |
| `task-overdue-tier-3` | `schedule_recurring`, `dueDate + 7 days` | `tasks` | `send_notification` | `parent_unit_head(assigneeTeamId)` |
| `task-daily-digest` | `schedule_recurring`, no date filter, target entity `users` | `users` | `send_task_digest` | `entity_field(id)` — the user being iterated |

All four are admin-editable in platform-ui/automations after seeding: can be disabled, cloned, condition-narrowed, template-customised.

**Supporting implementations in `packages/addons/tasks`:**
- **New action handler `SendTaskDigestAction`** registered via `ActionRegistry` in `onModuleInit()`. Receives the user row as `entityData`, queries tasks (assigned-to-me + unassigned-in-my-teams, matching the Q16 personal-queue query), bucketises into overdue / due today / due this week, composes one email, short-circuits if all buckets empty.
- **Register `users` with `EntityResolverRegistry`** so it becomes a valid `scheduleEntityType` (verify if already registered in `packages/core/users`; if not, add the registration there, not in tasks).

**Supporting implementations in `packages/addons/org-units`:**
- **Three user resolvers** registered via `UserResolverRegistry` in `onModuleInit()`:
  - `org_unit_head` — config `{ unitField }`; returns user whose position in that unit has the lowest `sortOrder`.
  - `parent_unit_head` — config `{ unitField }`; walks to parent via `org_units.parentId`, returns that unit's head. Empty array if root.
  - `org_unit_members` — config `{ unitField }`; returns all users assigned to the unit via `org_unit_positions`.
- These are generic platform primitives — usable by any entity that has an org-unit FK column, not just tasks.

**Why not `defineEntity()` as the declaration site:** seeded automation rules are auxiliary data, not entity schema. Mixing them into `defineEntity()` would couple entity-engine to automations (wrong dependency direction) and conflate schema with behaviour. Tasks package's seeds file is the right location.

**Why not code-level cron for the digest:** automations' `schedule_recurring` with `scheduleEntityType: 'users'` fires once per user per day at the rule's cron time — that IS the digest shape, expressed entirely through the existing primitive.

#### Q19c — Priority segmentation

**Decision:** No priority-based rule segmentation in V1. Single cadence applies to all tasks regardless of `priority`.

**Options considered:**
- (a) No segmentation — one cadence. _[chosen]_
- (b) Three seeded rules keyed on `priority = low | medium | high` with different day-spreads — rejected: premature rule proliferation for a use case no firm has asked for.
- (c) Drop `priority` from compliance tasks — rejected: priority still useful for UI sorting in the personal queue.

`priority` remains on the task for display/sorting (high-priority surfaces first in personal queue, digest within a section). It does **not** branch notification logic. If a firm later wants steeper cadence for high-priority, admin clones a seeded rule, adds `priority = high` condition, adjusts `scheduleDateAmounts`.

#### Q19d — Kind discriminator is template-context, not rule-scope

**Decision:** Seeded rules are **kind-agnostic**. They target `scheduleEntityType: 'tasks'` and fire for every task regardless of kind. `kind` is a template-rendering signal, not a rule-selection signal.

**Storage model:** `compliance_tasks` stays a separate table, 1:1 joined to `tasks` by shared primary key. Rationale:
- **Dependency direction:** compliance-specific columns (`clientId`, `ruleId`, `periodStart`, `periodEnd`) cannot live in `packages/addons/tasks` — that would pull domain concepts into a platform package.
- **No nullable-column bloat:** each task-using domain owns its extension columns in its own table.
- **Base scheduler only needs base columns:** `dueDate`, `status`, `assigneeId`, `assigneeTeamId`, `priority`, `title`, `kind` — all present on `tasks`. The scheduler never joins `compliance_tasks`.

**How kind surfaces in notifications:** the compliance task **generator** builds a semantically-rich `title` at task creation (e.g., `"GST return for ABC Corp — Mar 2026"`). Generic template `"Task '{title}' is overdue (due {dueDate})"` reads naturally without needing kind-specific template variables. V1 ships generic templates only.

**Per-kind template customisation (opt-in, deferred):** future work — a domain can either:
- Clone a seeded rule, add condition `kind = 'compliance'`, customise template with compliance variables (`{client.name}`, `{rule.name}`, `{period}`), OR
- Seed its own kind-scoped rules alongside the generic ones (and narrow the generic rules with `kind != 'compliance'` if it wants exclusivity).

Not needed for V1.

**Implications for build:**
- **Stream B (escalation):** 3 seeded rules + 2 new resolvers in org-units + 1 new action-handler dependency? No — standard `send_notification` suffices.
- **Stream D (digest):** 1 seeded rule + 1 new action handler (`SendTaskDigestAction`) + 1 new resolver (`org_unit_members`) + register `users` as schedulable entity.
- **All of the above lands in `packages/addons/tasks` and `packages/addons/org-units`** — compliance domain ships zero notification code in V1, just inherits the seeded rules.

---

### Q20 — Notification target when no individual assignee

**Decision:** For a team-assigned task with no individual assignee, **every team member** receives the T+0 escalation email and sees the task in their daily digest. Head has no special privilege at T+0 — their role kicks in at T+3.

**Options considered:**
- (a) Broadcast to every member at T+0; head escalation at T+3; parent-unit head at T+7. _[chosen]_
- (b) Head-only at T+0, members see it via digest — rejected: single point of failure if head is OOO; whole team loses email visibility.
- (c) Head + deputy at T+0 — rejected: "deputy" isn't a modelled concept; implied 2nd-lowest-sortOrder semantics is fragile and would need platform-level concept work.

**Why (a):** consistent with Q16 (personal queue shows self + unassigned team work to every member). The digest already surfaces the task to every member every morning; the T+0 escalation email is a louder form of the same signal. Broadcast creates mild "who picks it up" coordination but adds redundancy — if head is on leave, another member sees the signal and can claim/assign.

**Resolver config for tier-1 rule:**
- When `assigneeId IS NOT NULL` → resolve via `entity_field(assigneeId)`. One recipient.
- When `assigneeId IS NULL` → resolve via `org_unit_members(assigneeTeamId)`. Multiple recipients.

Since an automation rule can't branch user-resolution by a condition on the entity, **two tier-1 rules** are seeded (rather than one):

| Seed rule | Additional condition | Resolver |
|---|---|---|
| `task-overdue-tier-1-assignee` | `assigneeId IS NOT NULL` | `entity_field(assigneeId)` |
| `task-overdue-tier-1-team` | `assigneeId IS NULL AND assigneeTeamId IS NOT NULL` | `org_unit_members(assigneeTeamId)` |

Total seeded rule count in tasks package becomes **5**: two tier-1 variants, one tier-2, one tier-3, one daily digest. (Updates the table in Q19b implicitly — tier-1 row splits into two rows with the above conditions.)

**Edge case — task has neither `assigneeId` nor `assigneeTeamId`:**
Neither tier-1 rule fires. Tier-2/3 also need `assigneeTeamId` for head resolution, so they don't fire either. Task becomes invisible to escalation. Mitigation: base tasks package should treat a task with no team and no assignee as a configuration error — emit a domain event on overdue-with-no-target, firm admins subscribe via their own automation rule. **Deferred to a separate pending Q (Q20a) if we want to formalise, otherwise accept the edge case for V1.**

**Implication for build:** split seeded tier-1 rule into two; otherwise unchanged from Q19b.

---

### Q21 — User opt-out of notifications

**Decision:** **No per-user opt-out in V1.** Everyone receives every seeded notification. Firm admins retain firm-wide control by disabling a seeded rule in platform-ui/automations, but individual users cannot silence notifications for themselves.

**Options considered:**
- (a) No opt-out. _[chosen]_
- (b) Opt-out of digest only, escalations mandatory — rejected: adds UI and preference-check code path for a feature nobody has asked for.
- (c) Full per-rule opt-out via existing `notification_preferences` table — rejected for V1: wiring exists in `packages/platform/notifications/api/schema/notification-preferences.ts`, but turning it on for compliance rules creates a liability surface (staff silencing statutory deadline alerts).
- (d) Per-channel opt-out — moot in V1 (email-only channel).

**Why (a):**
- **Statutory audience, not consumer audience.** Compliance users are firm staff whose job is to file by deadline. "Turn off the emails" is the wrong affordance — inbox fatigue should be solved by *tuning cadence* (already done: T+0/3/7 + one digest), not by individual suppression.
- **Firm-wide control already exists** via admin disabling a seeded rule. Sufficient for V1.
- **Reversible.** The preference primitive is already in the platform; if a firm later asks, wiring it for specific rules is a small task.

**Edge cases:**
- User on leave — their notifications still fire, land in inbox, get read on return. Acceptable for V1. Future work: leave modelling (Q31) may want to route these to a cover colleague, but that's a separate decision.
- User with email delivery disabled at infra level (bounce, unsubscribed at SMTP) — platform-level concern; not a compliance decision.

**Implication for build:** nothing. `SendNotificationAction` remains preference-unaware for seeded compliance rules; no user-profile UI changes in V1.

---

### Q22 — Audit scope

**Decision:** Wildcard audit on every compliance-owned module. Each module registers with `AuditRegistryService` in `onModuleInit()` using `events: '*'`. Writes-only (reads not covered by platform — not planned for V1).

**Coverage (modules that must call `register`):**
- `clients`
- `client_registrations`
- `compliance_rules`
- `compliance_tasks`
- Any future compliance-owned module (new law types, handlers, etc.)

**Platform grounding (`packages/platform/audit`):**
- Action enum: `created | updated | deleted`. No read-audit primitive.
- Listener consumes domain events, writes `audit_logs` rows with `before`, `after`, `changes` (field-level diff), `correlationId`, `actorId`, `eventName`.
- Field-level diffs are automatic — derived from the event payload's `before` / `after` snapshots. Nothing to configure per event.
- `sensitiveFields` array on registration redacts named fields from snapshots (covered by Q24).

**Options considered:**
- (a) Wildcard (`events: '*'`) on every compliance-owned module. _[chosen]_
- (b) Selective allowlist — only status transitions, assignments, deactivations — rejected: "noise" argument is weak (diffs are tiny JSON; no future reader regrets too much detail), and the registration surface area per event is larger than just wildcarding.
- (c) Wildcard + new read-audit infrastructure — rejected: platform work, speculative for V1, not a standard CA-firm requirement (records are shared within firm; not GDPR-grade privacy).

**Build prerequisite (not a decision — a convention reminder):** compliance module services must emit events with `before`/`after` snapshots per `.claude/rules/event-conventions.md`. Without properly structured events, audit rows would be empty. Each service defines a `Snapshot` interface and `toSnapshot()` method.

**Implication for Stream E (Audit):**
- E1: Register each compliance module via `AuditRegistryService.register(moduleName, { events: '*', sensitiveFields: [...] })` in `onModuleInit()`.
- E2: Ensure every emitted update-event payload carries `{ before, after }` snapshots. Covered by the audit integration tests in each module.
- E3: No new audit schema or infrastructure. Platform's `audit_logs` table absorbs everything.

---

### Q23 — Audit visibility

**Decision:** Audit visibility **inherits from the subject entity**. If a user can read the entity, they can read its audit trail. Firm admins additionally get a global "all audit" view via a separate permission.

**Two audit-read surfaces in V1:**

| Surface | Permission | Visibility |
|---|---|---|
| Per-entity audit timeline (detail page tab) | Inherited from entity read permission + scope | Only rows with `entityType + entityId` matching an entity the user can already read |
| Firm-wide audit list | `audit.read_all` (firm-admin role only) | All rows across the firm |

**Why (c) — "audit inherits visibility of the subject":**
- **One source of truth for visibility.** No parallel audit-permission matrix to reason about — if you can see the task, you see its history.
- **Natural UX binding.** Detail page's "Audit Trail" tab (per the detail-page redesign memory) shows the entity's timeline. No mental model split between "can view record" and "can view record's history".
- **Team leads don't need admin escalation** to answer "who reassigned this task?" — they already have task-scope read.
- **Rejected alternatives:**
  - (a) Admin-only — too restrictive; routine audit questions require admin pinging.
  - (b) Parallel scope rows for audit — duplicates scope logic, two sources of truth.
  - (d) Self-only — covers auditing one's own actions but misses the main use case (seeing others' changes to records I'm responsible for).

**Implementation sketch (for Stream E):**
- Per-entity endpoint: `GET /audit-logs?entityType=X&entityId=Y` — controller authorises by delegating to the owning module's read-check (e.g., `complianceTasksService.canRead(user, taskId)`). Returns empty list if user can't read the entity.
- Firm-wide endpoint: `GET /audit-logs` (no `entityType` filter) — requires `audit.read_all` permission, not gated by scope.
- Redaction: `sensitiveFields` list from registration (Q24) applies uniformly to both surfaces.

**Edge cases:**
- **Entity was deleted** — audit row persists, but the subject is gone. In V1, soft-deleted entities remain readable by their owners (platform convention), so their audit trail remains visible. Hard-deleted entities' audit rows become visible only to `audit.read_all` holders.
- **User's scope changed** (e.g., moved to a different unit) — subsequent reads honour current scope. Historical rows they previously saw are no longer visible if the entity has moved out of their scope. Acceptable.
- **Cross-entity correlations** (`correlationId`, `targetEntity*`) — returned rows may reference related entities the user can't read. V1: return the row with fields as-is; downstream UI may render target entity IDs without resolving names when out of scope. Defer a "hide correlation leak" polish.

**Implication for build:**
- E4: `audit.read_all` permission registered by platform audit module (already exists — verify).
- E5: Per-entity audit endpoint added to each compliance controller OR a generic `GET /audit-logs?entityType=X&entityId=Y` that performs authorisation delegation. Prefer the generic endpoint to avoid duplication across domains — but requires a permission-check registry on `AuditRegistryService` (`authoriseRead: (user, entityId) => Promise<boolean>`). Minor platform extension.

---

### Q24 — Sensitive field redaction

**Decision:** Redact **tax identifiers only**. No other PII redaction in V1.

**Redacted fields:**

| Module | Field | Rationale |
|---|---|---|
| `clients` | `taxId` (PAN / GSTIN) | Indian PII; audit logs persist longer than working records, export leakage would be problematic. |
| `client_registrations` | `registrationNumber` | Same reasoning — individual GSTIN / TAN / PAN for that registration. |

**Not redacted:**
- `clients.contactEmail`, `clients.contactPhone` — business contact info, already sprayed across emails / invoices / CRMs. Redacting in audit gives false confidence; audit value ("who changed the contact email?") is exactly the point.
- `compliance_rules.*` — metadata, no PII.
- `compliance_tasks.*` — work state, no PII.

**Options considered:**
- (a) Redact tax IDs only. _[chosen]_
- (b) Redact tax IDs + email + phone — rejected: redacting already-spread fields creates a false privacy signal without adding real protection.
- (c) No redaction — rejected: tax IDs are the one class of field where export leakage has regulatory weight.
- (d) Redact tax IDs + email, keep phone — rejected: inconsistent; either treat "contact details" as redacted or not, and not-redacted is the right call.

**Registration shape (Stream E1):**
```ts
// In clients module onModuleInit
this.auditRegistry.register('clients', {
  events: '*',
  sensitiveFields: ['taxId'],
});
// In client_registrations module onModuleInit
this.auditRegistry.register('client_registrations', {
  events: '*',
  sensitiveFields: ['registrationNumber'],
});
```

**Behaviour:**
- `audit_logs.before` and `audit_logs.after` JSONB will carry `"taxId": "[REDACTED]"` (or whatever platform redaction sentinel is) for those fields.
- `audit_logs.changes` still records that the field changed and when / by whom — just not the before/after values.
- UI detail-page audit tab will render "taxId changed" without revealing the old or new value.

**Edge case — redaction list grows later:** redaction applies at audit-write time. Rows written before a field was added to `sensitiveFields` retain un-redacted values. Not a V1 blocker since the list is fixed at seed time, but intersects with Q25 (retention) — if we ever purge audit rows, we lose any un-redacted historical values naturally.

---

### Q25 — Audit retention

**Decision:** **Keep audit rows forever.** No purge policy in V1.

**Options considered:**
- (a) Keep forever. _[chosen]_
- (b) Time-based purge (e.g. 7 years) — rejected: Indian income tax scrutiny can reopen assessments up to 10 years back in serious cases; a 7-year purge creates gaps exactly when evidence matters most.
- (c) Cascade-delete on hard-deletion of subject entity — rejected: if a client is hard-deleted, the audit trail IS the evidence for why. Purging with the entity defeats the purpose.
- (d) Per-entity-type retention (tasks shorter, clients longer) — rejected: premature tuning for a storage problem that doesn't exist.

**Rationale:**
- **Statutory context.** CA firm audit trails have 10+ year scrutiny windows. Forever is the safest default; a purge policy is impossible to reverse.
- **Storage is trivial.** ~10K rows/year for a 200-client firm. 10 years = 100K rows of JSONB diffs — kilobytes.
- **Asymmetric cost.** Purged rows are gone. Retaining too much is cheap; retaining too little is catastrophic when needed.

**Edge cases:**
- **Hard-deleted subject entity** — audit rows persist with their `entityType` + `entityId`, but the subject no longer resolves. UI renders the stale ID with a `[deleted]` marker. Acceptable in V1 since hard delete is rare / admin-only.
- **Tenancy offboarding** (future) — when a tenant is offboarded, their audit rows get purged along with all their other data. Out of scope for V1 since multi-tenancy isn't fully wired yet.
- **Redaction-list growth** (from Q24) — rows written before a field joined `sensitiveFields` retain un-redacted values. With no purge, those rows remain discoverable. Acceptable; if a future firm needs retroactive redaction, it's a one-off backfill script, not a retention policy.

**Implication for build:** nothing. No purge cron, no retention column, no per-entity-type config. `audit_logs` table just grows.

---

### Q26 — Attachment file-type whitelist

**Decision:** Single whitelist applied uniformly to all compliance-domain attachments. Defined as a constant in the compliance domain (e.g. `COMPLIANCE_ATTACHMENT_MIME_TYPES` in `domains/compliance/api/constants.ts`), passed via `AttachmentConfig.acceptedMimeTypes` wherever `AttachmentsService.upload()` is called from compliance.

**Accepted MIME types:**

| MIME | Extension | Use |
|---|---|---|
| `application/pdf` | .pdf | Filing acknowledgements, challans, notices |
| `image/png` | .png | Portal screenshots |
| `image/jpeg` | .jpg, .jpeg | Portal screenshots |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | .xlsx | Workings, reconciliations |
| `application/vnd.ms-excel` | .xls | Legacy Excel |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx | Drafts, cover letters |
| `application/msword` | .doc | Legacy Word |
| `text/csv` | .csv | Plaintext data exports |

**Rejected explicitly:**
- **ZIP** — hides contents from scanning, nesting risk. Firms needing multi-file bundles upload individually. Revisit post-V1 if demand emerges, then only with a virus-scan gate.
- **Executables and scripts** (.exe, .bat, .sh, .js, .html, .htm, etc.) — security risk. Must not be on the whitelist regardless of user request.
- **RTF** — legacy; PDF/DOCX cover the same use.
- Everything else by default (whitelist, not blocklist).

**Options considered:**
- (a) The eight types above. _[chosen]_
- (b) Same plus ZIP — rejected: allows nested executables without a scanner in V1.
- (c) Same but drop CSV (force XLSX) — rejected: CSV is plaintext, safe, and common for tax-authority data exports.
- (d) Accept all (`*/*`) with downstream virus-scan — rejected: no scanner in V1.

**Platform grounding:** `packages/addons/attachments/api/services/attachments.service.ts` validates MIME per request via `isMimeTypeAccepted(file.mimetype, acceptedTypes)`. No platform changes needed — compliance just passes the list.

**Scope consideration:** clients/registrations/rules don't attach files in V1 MVP (no attachment UI on those entities). If a future PR adds them, they'll reuse the same `COMPLIANCE_ATTACHMENT_MIME_TYPES` constant.

**Implication for build:**
- Stream F (Attachments): add `COMPLIANCE_ATTACHMENT_MIME_TYPES` constant; pass via `AttachmentConfig` when wiring the task-detail upload call. Zero platform work.

---

### Q27 — Attachment max size

**Decision:** **25 MB per file.** No per-task aggregate cap. No firm-wide storage quota.

**Options considered:**
- (a) 25 MB per file, no aggregate, no quota. _[chosen]_
- (b) 10 MB per file — rejected: forces compression workflow for multi-page scanned notices, adds friction for legitimate use.
- (c) 50 MB per file — rejected: rare to legitimately need >25MB; headroom invites misuse.
- (d) Per-firm quota — deferred: requires usage-tracking infrastructure in `packages/addons/attachments` or `packages/platform/media` (counter table + enforcement at upload + admin-visible usage panel). Not V1-scoped. Revisit if storage cost becomes a real problem post-launch.
- (e) Per-task aggregate cap — rejected: creates surprising failures ("why can't I add this 11th doc?"). Per-file cap is predictable; aggregate is opaque.

**Why 25 MB:**
- Covers all realistic V1 document shapes: filing acknowledgement PDFs (<2MB), portal screenshots (<1MB), Excel workings up to 15MB, multi-page scanned notices up to 20MB.
- Platform default `DEFAULT_MAX_FILE_SIZE` in `@packages/media` is already reasonable; compliance passes 25MB explicitly via `AttachmentConfig.maxFileSize` for clarity/override.
- Small enough that even a rogue uploader can't fill a reasonable disk quickly; large enough to not annoy legitimate users.

**Implication for build:**
- Stream F: add `COMPLIANCE_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024` constant alongside the MIME whitelist (Q26). Pass via `AttachmentConfig.maxFileSize`. Zero platform work.

**Follow-up post-V1:** if firms start hitting storage-cost issues, add usage tracking + firm quota as a separate feature — probably per-tenant counter + enforcement hook in `MediaService.upload()`. Keep it out of V1.

---

### Q28 — Attachment retention

**Decision:** Keep attachments forever — rows and storage blobs alike. No time-based purge. Soft-deleted attachments remain in DB + storage.

**Options considered:**
- (a) Keep forever (soft-delete stays in DB + storage). _[chosen]_
- (b) Purge soft-deleted after N days to reclaim storage — rejected: risks losing a filing document that gets revisited in a post-purge scrutiny.
- (c) Cascade hard-delete when owning task is hard-deleted — rejected: attachment outlives subject, same principle as Q25. Hard-deleted task + hard-deleted attachment means zero evidence of the work.
- (d) Purge N days after task marked completed — rejected: breaks when a closed task needs to be reopened for scrutiny (common in tax assessments reopened 5+ years later).

**Rationale (mirrors Q25):**
- **Statutory context.** The attachment IS the evidence of filing. Acknowledgement PDFs, signed returns, portal receipts — these are the artefacts a firm produces to prove work was done. Losing them in a purge is losing the case when scrutiny reopens years later.
- **Storage economics.** ~200 clients × 5 filings/year × 3 docs × 2MB ≈ 6GB/year. 10 years = 60GB. Trivial at platform level; becomes a firm-quota problem if it becomes one (deferred per Q27).
- **Soft-delete already gives the UX affordance** ("I deleted it by accident" → admin-recoverable from DB + storage) without losing data.

**Platform grounding:**
- `attachments.deletedAt` + `deletedBy` columns exist; soft-delete is built in.
- `attachments-cleanup.listener.ts` cascades soft-delete when the owning entity is deleted — **verify behaviour**: confirmed in `packages/addons/attachments/api/listeners/attachments-cleanup.listener.ts` that the listener soft-deletes (not hard-deletes) on entity removal. Matches V1 intent.
- No platform changes needed.

**Edge cases:**
- **Storage blob for soft-deleted attachment** — remains in the storage bucket. Platform's `hardDelete()` method exists and removes both row and blob, but compliance controllers never call it. Only triggered by admin tooling (out of V1 scope).
- **Orphaned blobs after subject entity hard-delete** — cleanup listener only soft-deletes rows, so the blob stays referenced via the row. Soft-delete is the correct behaviour; no orphans.
- **Uploader leaves the firm** (intersects Q32 termination) — attachment row keeps the old `uploadedBy` FK. User soft-delete (if that's how the firm handles offboarding) doesn't affect the attachment. Safe.

**Implication for build:**
- Stream F: no retention code. Compliance controllers use `AttachmentsService.softDelete()` only (never `hardDelete()`). `attachments-cleanup.listener` handles the entity-cascade case automatically.

---

### Q29 — Comment mutability

**Decision:** Accept the `packages/addons/notes` addon defaults. Authors can edit and soft-delete their own notes at any time; `updatedAt` auto-tracks edits; domain events feed the audit trail with before/after content so the history is preserved even when the latest version is shown in UI.

**Compliance task "comments" = notes addon attached to `compliance_tasks` entity.** No new table, no new service.

**Options considered:**
- (a) Platform defaults (author-editable, author-deletable, `updatedAt` on edit, audit via events). _[chosen]_
- (b) Append-only / immutable — rejected: typos become permanent; unnatural vs. Slack/Linear/GitHub norms.
- (c) Edit-only-within-N-minutes window — rejected: timer primitive for marginal benefit; audit already solves the integrity concern.
- (d) Admin override (author + firm admin can edit any note) — rejected: path to revisionism; uncomfortable for compliance context even though audit captures it.

**Why (a):**
- **Zero build** — notes addon already enforces the author-only guard.
- **Audit carries integrity.** Q22 wildcard registers `notes.*` events; `NOTES_NOTE_UPDATED` payload includes before/after content (per event-conventions.md), so every edit is in `audit_logs`. UI detail-page audit tab shows the edit history.
- **User expectation alignment.** Slack / Linear / GitHub all allow post-hoc edits with an `(edited)` marker. Compliance reviewers reading a 6-month-old thread won't be surprised.

**UI rendering:**
- When `updatedAt > createdAt` (with a small tolerance for creation write-time jitter), render an `(edited)` marker beside the timestamp.
- Hovering the marker shows `Last edited {relativeTime}` tooltip.
- Historical versions are not inline — they live in the audit trail (Audit Trail tab → filter by note ID).

**Edge cases:**
- **Author leaves the firm** (intersects Q32) — their notes remain visible attributed to their name; they can no longer edit (they're deactivated / removed). Uncontroversial.
- **Admin hard-delete of a note** — not exposed in V1. If `packages/addons/notes` offers an admin surface, compliance doesn't expose it. Future work if a firm ever needs moderation.
- **`isInternal` toggle** — notes addon supports public/internal; compliance V1 stays internal-only (all notes `isInternal: true`). Client-facing notes can be added later if/when client portal arrives.

**Implication for build:**
- Stream G (comments): thin wiring — compliance task detail page mounts the notes UI (`packages/addons/notes/ui/hooks.ts`) with `entityType: 'compliance_tasks'`. No API work beyond controller-level permission check that delegates to task read-scope (Q23 visibility principle extends to notes on the task).

---

### Q30 — Comment @mentions and notifications

**Decision:** Support `@user` mentions in compliance task comments. When a user is mentioned, they receive an **in-app notification** (notification bell / panel), not an email, in V1. Email delivery for mentions is deferred.

**Platform grounding:**
- **Mention parsing is built** — `packages/addons/notes/api/helpers/extract-mentions.ts` parses mention tokens from content.
- **Mention storage is built** — `note_mentions` table records `(noteId, userId)` pairs on note create/update.
- **`NOTES_NOTE_CREATED` / `_UPDATED` events carry `mentionedUserIds: string[]`** in the payload.
- **In-app notification channel is fully built** — `packages/platform/notification-channels/in-app/` provides `InAppChannelService`, `NotificationQueryService`, `/user-notifications` API, plus `NotificationBell.tsx` UI component. Compliance already has a `NotificationPanel.tsx`.
- **Email channel also exists** — but intentionally not wired for mentions in V1.

**Options considered:**
- (a) Full mentions + email notification — rejected for V1: over-eager delivery, easy to become noisy; reserve for follow-up once firms ask for it.
- (b) Mentions + in-app notification only. _[chosen]_
- (c) Defer mentions entirely — rejected: collaboration UX is a core compliance need (reviewer handoff happens via comment); firms will work around via side-channel (WhatsApp), breaking the audit trail.

**Build shape:**
- **One seeded automation rule** in `packages/addons/notes/api/seeds.ts`: event trigger on `NOTES_NOTE_CREATED` (and `_UPDATED` for mentions added post-hoc) where `mentionedUserIds` is non-empty. Action: `send_notification` to the **in-app channel only**. User resolution: `entity_field` on the `mentionedUserIds` array field in the event payload.
- **`SendNotificationAction` channel control:** verify the action supports per-rule channel selection (e.g. `config.channels: ['in_app']`). If it currently fans out to all of a user's active channels, add a `channels` config option on the action handler. Minor platform extension if needed, co-located with the existing notification work.
- **Template (kind-agnostic):** `"{authorName} mentioned you on {taskTitle}: {commentPreview}"`. Content preview is clipped (e.g. first 100 chars) to avoid leaking long comments into notifications.
- **Multi-user array resolution:** `entity_field` strategy already handles array values (`related-entity-field.strategy.ts:61–63`); confirm the standalone `entity_field` strategy does the same, else add the array path (trivial).

**Where the rule lives:**
- In `packages/addons/notes` (not tasks, not compliance). Notes addon owns `note_mentions` + the mention event; seeding the mention-notification rule there keeps the feature local. Any notes-using domain benefits automatically.

**Opt-out interaction with Q21:** Q21 locked "no per-user opt-out in V1" for compliance notifications. Mention notifications fall under the same umbrella in V1 — no user opt-out. If mention-spam becomes a real problem, admins can disable the seeded rule firm-wide; revisit user-level opt-out as a separate future decision.

**Email delivery for mentions (deferred):**
- When added later, it's a trivial rule change — flip the action `channels` config to `['in_app', 'email']` or clone the rule with an email channel.
- Keeping email off in V1 avoids inbox fatigue during early usage and gives firms time to establish mention norms before we add a louder channel.

**Edge cases:**
- **Self-mention** — if an author @-mentions themselves, suppress the notification (don't notify-yourself). Enforced in the action handler or via a `mentionedUserIds != authorId` condition on the rule.
- **Mentioned user is deactivated** — skip. `SendNotificationAction` should already no-op on deactivated recipients; verify.
- **Note edited to ADD a new mention** — `_UPDATED` event fires; seeded rule listens to both `_CREATED` and `_UPDATED`. But we must not re-notify users who were already mentioned in the prior version. Diff logic: notify only users in `after.mentionedUserIds` but NOT in `before.mentionedUserIds`. This diff lives in the action config (or a condition on the rule if it can express set-difference). **Flag as a build subtlety** — may need a tiny handler-level helper rather than pure declarative condition.
- **Note edited to REMOVE a mention** — no un-notify action; the in-app notification already delivered remains. Acceptable.

**Implication for build:**
- **Stream G extension:** add seeded mention-notification rule in `packages/addons/notes/api/seeds.ts`.
- **Platform check:** confirm `SendNotificationAction` supports per-channel selection; add if missing.
- **Edit-diff logic:** handler-side "only-new-mentions" filter on `_UPDATED` events.
- **UI:** mention notifications appear in existing `NotificationBell` / `NotificationPanel`. No new UI.

---

### Q31 — Leave modelling

**Decision:** **No leave modelling in V1.** Staff on leave are not a distinct state in the system. Short leaves are absorbed by the existing T+0 / T+3 / T+7 escalation tiers; indefinite leave is handled the same as termination (see Q32).

**Options considered:**
- (a) No leave model. _[chosen]_
- (b) Boolean `onLeave` on users + suppress notifications — rejected: suppression removes the firm's safety signal; user returns to a silent inbox with no evidence of what happened.
- (c) Date-range `leaveSince` / `leaveUntil` + auto-redirect notifications to team head in range — rejected: non-trivial state machine and scheduler integration for a behaviour already solved by escalation.
- (d) Full time-off module (approvals, coverage, PTO balance) — rejected: correctly out of V1 scope.

**Why (a):**
- **Realistic firm behaviour.** CA firms already run on "tell your manager before you leave". Managers manually reassign the 2–3 tasks that matter during the leave window. System-level leave is ceremony for a behaviour that's already solved socially.
- **Escalation IS the coverage mechanism.** If an assignee is on leave when T+0 fires and doesn't act → T+3 emails the team head → someone else takes action. The three-tier escalation (Q10 / Q19a) is coverage by design.
- **"Suppress notifications" is the wrong affordance.** Notifications are the firm's best signal that something needs attention; silencing them removes the safety net. A full inbox on return is not a blocker — a missed statutory deadline is.
- **Indefinite leave ≡ termination.** Staff on open-ended leave are functionally deactivated; Q32's termination flow (null task assignments, remove team memberships) applies.

**Edge cases:**
- **Known short leave (e.g. 3-day wedding):** manager reassigns high-priority tasks before the staff leaves. T+3 / T+7 handle anything missed. Acceptable.
- **Known longer leave (e.g. 2-week holiday):** same mechanism, more manual reassignment. Still acceptable for V1.
- **Unplanned / emergency leave (illness):** escalation tiers absorb it automatically. No admin intervention needed.
- **Parental leave / sabbatical (months):** treat as termination per Q32 (deactivate user, null task assignments, remove from team). Reinstate by reactivating when they return. Firm-admin operation, no separate leave state.

**Non-goals for V1:**
- Auto-routing of T+0 emails to team head when `onLeave: true` — explicitly out of scope; T+3 already covers this a few days later.
- Leave balance / approval workflow — not platform concern.
- Out-of-office auto-reply on notifications — not valuable enough for V1.

**Implication for build:** nothing. No leave state, no leave UI, no leave-aware scheduling. The three-tier escalation + Q32 termination flow together cover every scenario V1 needs.

---

### Q32 — Termination behaviour

**Decision:** Event-driven cascade on `USERS_USER_DEACTIVATED`. No transactions needed for V1 — the user-coupled entities that matter (tasks, team memberships) are cleanup-able asynchronously because query-time guards on `users.deactivatedAt` make the window invisible. Reinstatement creates a clean slate (no auto-restore of prior state); history is preserved for audit.

**The authoritative signal:** `users.deactivatedAt`. Flip this to a timestamp and the user is functionally gone — consumers already filter on `deactivatedAt IS NULL`, so they disappear from resolvers, personal queues, escalation recipients, and notification targets the moment the flag is written.

**Event-driven cleanup (background GC, not a correctness requirement):**

| Listener location | Work done |
|---|---|
| `packages/addons/tasks` | On `USERS_USER_DEACTIVATED`: `UPDATE tasks SET assigneeId = NULL WHERE assigneeId = :userId AND status NOT IN ('completed', 'cancelled')`. Team remains assigned via `assigneeTeamId`, so the task is still routable and falls into Q20's team-fallback path. |
| `packages/addons/org-units` | On `USERS_USER_DEACTIVATED`: `DELETE FROM org_unit_positions WHERE userId = :userId`. Removes the user from membership resolvers going forward. |

Both listeners are idempotent — re-running them on the same event is a no-op. If a listener crashes, retry (or re-process from queue); no corruption.

**Options considered:**
- (a) Event-driven cleanup. _[chosen]_
- (b) Transactional cascade via direct service calls — rejected for V1: `users` is a core package, cannot import from addons (`packages/core/users` → `packages/addons/tasks` violates dependency direction). A transactional cascade would require moving orchestration up to the app or domain tier, which is unnecessary complexity when query-time guards already make the cleanup non-urgent.
- (c) Admin manually reassigns + removes — rejected: manual steps for mechanical work invite omissions.
- (d) Synchronous CLI cascade (one-shot script) — rejected: same orchestration problem as (b), plus harder to trigger from admin UI.

**Why tasks + team memberships are side effects, not transactional participants:**

The test for "is this cleanup transaction-worthy?" is three questions:

| Test | Task assignee nulling | Team membership removal |
|---|---|---|
| If cleanup never ran, would the system give wrong answers to users? | **No** — `deactivated_at IS NULL` guard covers every consumer path (resolvers, task list, personal queue, notifications) | **No** — same guard; deactivated user is invisible to members / head resolution even if `org_unit_positions` row remains |
| Would the system accept new operations that shouldn't be possible? | **No** — user can't log in; resolvers don't return them; notifications skip them | **No** — same |
| Is there a correctness-critical constraint broken by delay? | **No** — stale FK is harmless; consumers JOIN + filter | **No** — same |

Three "no"s → **side effect**. The `deactivatedAt` flag is the authoritative signal; cleanup is hygiene (keeping FK references tidy), not a correctness mechanism.

**Why not hooks?**

A "hook registry" pattern — each participating package registers a callback that runs inside the user-deactivation transaction — is architecturally clean and is the right shape for transactional cross-package cleanup. It fits the platform's existing registry-style DI (`AuditRegistryService`, `ActionRegistry`, `UserResolverRegistry`, etc.) and it doesn't violate dependency direction (addons push into a core-defined registry).

But hooks are the right tool only when a participant's cleanup is **correctness-critical** — i.e., if you removed the `deactivatedAt` guard from its consumer path, the system would give wrong answers. For tasks and team memberships, that's not the case — the guards carry correctness, cleanup is hygiene.

**The decision rule for future user-coupled entities:**

> If the entity's cleanup would be *incorrect* without a `deactivated_at IS NULL` guard on every consumer, register it as a **hook** (runs inside the deactivation tx).
> If the consumer can filter on `deactivatedAt` and tolerate a cleanup delay, use an **event** (runs after commit, idempotent, retry-safe).

Example cases that would require hooks (not compliance V1 concerns):
- Financial signatory authority revocation where the signing path doesn't check `deactivatedAt` on every call.
- Unique-constraint conflicts where deactivation must immediately free a reusable slot.
- External-system sync where the atomic "user is gone" signal must precede any follow-up operation.

None of these describe compliance V1.

**When a first hook-worthy participant arrives, build the registry then — not before.** Platform accretion rule: don't build the `UserLifecycleRegistry` primitive speculatively; wait for a concrete use case.

**Rejected: passing tx objects through events.**

- Events carry messages, not transactional context. Passing a tx object conflates "broadcast with independent handlers" and "transactional participants" into one mechanism.
- Transactional cascade via events means handler failure rolls back the domain op — the opposite of `event-conventions.md`'s "handler failure never rolls back the domain operation".
- Out-of-process listeners (queue workers) cannot receive a tx — Drizzle tx objects are session-bound and non-serializable. You'd end up with two dispatch paths with different semantics.
- Multi-listener events + shared tx → ambiguous failure semantics (one fails, all roll back? some commit, some don't?).

**The clean split:**

| Need | Mechanism |
|---|---|
| Transactional cross-module cleanup (correctness-critical, caller cares about failure) | **Hooks** — participating packages register callbacks via a core-owned registry; callbacks run inside the deactivation `db.transaction()` |
| Side-effect cleanup (hygiene, caller tolerates eventual consistency) | **Events** — emitted after commit, idempotent listeners, retry-safe |
| Direct call inside a single tx at the orchestrator tier | Works when the orchestrator (app/domain) knows all participants and their dependency tiers allow it. Less flexible than hooks when participants are plugins. |

Compliance V1 has zero correctness-critical cleanup. Pure event-driven for this release.

**Query-time guards (the real correctness mechanism):**

| Consumer | Guard |
|---|---|
| `org_unit_members` resolver | `AND users.deactivated_at IS NULL` |
| `org_unit_head` resolver | `AND users.deactivated_at IS NULL` |
| `parent_unit_head` resolver | `AND users.deactivated_at IS NULL` |
| Task list views (assignee column) | Hide / anonymise assignee when deactivated |
| Personal queue (`my-tasks` scope) | `WHERE users.deactivated_at IS NULL` on the user-context side |
| Mention notification (Q30) | Skip deactivated recipients |

With these in place, the eventual-consistency window for the GC listeners is invisible. Even if the tasks/org-units listeners never ran, the system would still behave correctly — deactivated user just lingers as dangling FK references that nobody queries.

**Reinstatement:**
- Admin reactivates user → `users.deactivatedAt = NULL` (and emit `USERS_USER_REACTIVATED` for audit).
- **No auto-restore** of prior task assignments or team memberships. Admin re-adds to teams via fresh `org_unit_positions` rows. Admin reassigns tasks that need it.
- History (audit rows, note authorship, attachment uploader FKs, completed-task assignee references) is preserved unchanged.
- Rationale: months after termination, prior assignments are stale (tasks reassigned, priorities shifted, teams restructured). Clean slate avoids surprise resurrection of work state.

**Edge cases:**
- **User deactivated while holding the only "head" position in a unit** — after position removal, resolver returns empty head list. Escalations for that unit's tasks fall back to `parent_unit_head` at T+3, and if no parent either, the task stays in "no head" state (UI should surface this to firm admin as a coverage gap). Acceptable for V1; firm admin resolves by promoting another member via new sortOrder.
- **User was `actorId` on in-flight automation rules** — no impact. Automation doesn't re-check actor's deactivation state for already-fired rules.
- **User authored pending notes** — notes remain attributed. `(deactivated)` badge can be added next to their name in UI as polish. Not a V1 blocker.
- **Historical task completions** — `completedBy` (if present on tasks schema) unchanged; the fact that X completed Y months ago stays true regardless of X's current status.

**Non-goals for V1:**
- Auto-deletion of user records — `users.deactivatedAt` is a flag, not a hard delete. Data retention matches Q25 audit retention (keep forever).
- Handover workflow (assign a "replacement" during deactivation) — future work if firms ask. In V1, admin manually reassigns the handful of tasks that matter.
- User delete API — not exposed to admins. Deactivation is the only off-ramp.

**Implication for build — Stream H (Employee lifecycle):**

- H1: Verify `users.deactivatedAt` column exists in `packages/core/users` schema; add if missing.
- H2: Emit `USERS_USER_DEACTIVATED` / `USERS_USER_REACTIVATED` events in user service.
- H3: In `packages/addons/tasks`, add cleanup listener (`@OnEvent(USERS_USER_DEACTIVATED)` → null assignee on open tasks).
- H4: In `packages/addons/org-units`, add cleanup listener + add `deactivated_at IS NULL` guards to the three resolvers from Q19b (`org_unit_head`, `parent_unit_head`, `org_unit_members`).
- H5: Add `deactivated_at IS NULL` guard to `my-tasks` personal-queue scope in `packages/addons/tasks/api/tasks.config.ts`.
- H6: UI — admin user list exposes "Deactivate" action; confirmation modal summarises consequences ("X will lose team memberships; open tasks will be team-reassigned"); action sets `deactivatedAt`.

All H* tasks land in `packages/core/users`, `packages/addons/tasks`, or `packages/addons/org-units` — **compliance domain ships zero code** for this, same inheritance pattern as Q19 / Q20.

---

## 2. Pending decisions

_All decisions locked. This section is intentionally empty — any new questions that emerge during implementation get appended here and moved up to §1 once resolved._

---

## 3. Build task list

Derived from §1. Re-estimated and re-ordered whenever §1 grows. Each bullet is intended to be one commit; siblings can be bundled into one PR at natural package seams per the worktree / PR rules.

> Legend: `[ ]` not started · `[~]` in progress · `[x]` done.

### Stream A — Tasks package hardening (platform-level, no compliance deps)

Shipped as PR #970 (2026-04-22).

- [x] **A1.** Drop the XOR constraint (`validateAssigneeExclusivity` in `tasks.config.ts:8` and the swap logic at `:107–113`). Tighten `assigneeTeamId` to `NOT NULL` via migration. After this, a task must always have a team and may optionally have an individual — both can coexist. (Q2)
- [x] **A2.** Define task action permission slugs (`tasks.view`, `tasks.pickup`, `tasks.reassign`, `tasks.review`, `tasks.complete`, `tasks.reopen`, `tasks.close`) as constants in the tasks package. (Q3)
- [x] **A3.** Add a system seed in the tasks package that upserts these permissions into the permission registry. Wire into the CLI's system-seed run. (Q3)
- [x] **A4.** Add action-level guards / service methods: `pickupTask`, `reassignTask`, `reviewTask`, `markComplete`, `reopenTask`, `closeTask`. Each enforces permission + scope + task-relationship (assignee / team member / head) checks. (Q3)
- [x] **A5.** Expose the new action endpoints in the tasks controller with proper DTOs. Include each task's list of currently-allowed actions in the list/get response so the UI can disable buttons without hardcoding status slugs. (Q3, Q4)
- [ ] **A6.** Verify scope-on-position integration end-to-end (position → scope, scope resolver, descendants walk). Close gaps _in the org-units / rbac packages_, not in the tasks package. (Q3 — "first implementation step") — *deferred; `allowedActions` exposure on list/get responses also deferred from A5.*
- [x] **A7.** Define the task lifecycle workflow on the base `tasks` entity in `tasks.config.ts` via `defineEntity()`. Five states (`pending / in_progress / blocked / completed / cancelled`), transitions per §1 Q4, transition guards (`blocked` requires a reason comment). Mark `completed` and `cancelled` states with `isSystem: true` so they cannot be renamed or deleted via the admin UI. If the workflow package persists definitions, wire a system seed in the tasks package. (Q4)
- [x] **A8.** Add the per-action `allowedStatuses` configuration (action gate) alongside the action guards from A4. Compose the gate with permission + scope on every action entry point. (Q4)
- [x] **A9.** Narrow the `my-tasks` custom scope in `packages/addons/tasks/api/tasks.config.ts:122–135` from "assignee = me OR any team I'm in" to "assignee = me OR (assignee is null AND team in myTeams)" so the personal queue shows unassigned-in-my-teams but not teammates' active work. (Q16)

### Stream B — Escalation subsystem (platform-level, consumes tasks package)

Revised scope per Q19b/Q20: no bespoke resolver or cron — three user-resolver strategies in `@packages/org-units` + four seeded automation rules in `@packages/tasks`, executed by the platform's existing `ScheduleScanner`. The `automation_sent_log` table (unique on `ruleId, entityType, entityId, targetDate`) gives B3 for free.

Stream B shipped as PR #980 (2026-04-22).

- [x] **B1.** Escalation-target resolver primitives — supplied by three `UserResolverStrategy` classes in `@packages/org-units` (`org_unit_head`, `parent_unit_head`, `org_unit_members`), registered on `UserResolverRegistry` in `OrgUnitsModule.onModuleInit()`. Per-tier target is composed at the rule level using these plus the built-in `entity_field` strategy. Ships co-heads tie-break (Q3) and parent-walk via `org_units.parentId`. Fallback to "users holding `all` scope on compliance tasks" is deferred — the daily digest (Stream D) still surfaces orphan tasks.
- [x] **B2.** Four system-seeded automation rules in `@packages/tasks` covering T+0 assignee (`entity_field(assigneeId)`), T+0 team broadcast (`org_unit_members(assigneeTeamId)`), T+3 (`org_unit_head(assigneeTeamId)`), T+7 (`parent_unit_head(assigneeTeamId)`). Each pairs a generic notification template with `schedule_once` + `scheduleDateField: 'dueDate'` + `scheduleDateOperator: 'after'`. **Deviation from Q19b's table:** implementation uses `schedule_once` rather than the `schedule_recurring` originally specified — `schedule_recurring` would re-send every scan while the date condition held, contradicting Q19a's "three emails max per task" invariant. The Q19b table below has been kept as-written for historical context; the shipped seed is authoritative.
- [x] **B3.** Idempotency — satisfied by the platform's existing `automation_sent_log` (unique `ruleId × entityType × entityId × targetDate`). No additional tracking table needed.

### Stream C — Compliance domain role, position & scope seeds

Shipped as PR #973 (2026-04-22).

- [x] **C1.** System seed: default roles (Preparer, Reviewer, Team Lead, Firm Admin) with the permission sets defined in the Q15 tables (task permissions + compliance-entity CRUD permissions). Added to `complianceSystemSeedSources()` in `domains/compliance/api/seeds.ts`. (Q3, Q15)
- [x] **C2.** Demo seed: sample user ↔ role assignments reflecting a realistic small firm. (Q3)
- [x] **C3.** System seed: five default positions with stable internal identifiers — Member (sortOrder 2), Lead (1), Head (0), Division Head (0, used on division-level units), Firm Admin (lowest sortOrder). Display names admin-editable. (Q14)
- [x] **C4.** System seed: `(position × task-entity)` scope rows for both the base `tasks` entity and the `compliance_tasks` extension. Member/Lead/Head → `unit`, Division Head → `descendants`, Firm Admin → `all`. 10 rows total. No scope seeds for non-task entities in V1. (Q14)
- [x] **C5.** UI warning on role assignment when the assigned role's tier and the user's position tier don't align (e.g. Team Lead role on a Member position). Non-blocking advisory. (Q14)

### Stream D — Notifications wiring for compliance due dates

Stream D shipped as PR #982 (2026-04-22). The per-task overdue email (originally scoped as D2) was absorbed into Stream B's T+0 tier-1 rules; D3's target resolution is handled by the B1 resolvers + the digest's `entity_field(id)` recipient.

- [x] **D1.** Daily digest — seeded as the `task-daily-digest` automation rule: `schedule_recurring` against `users`, `scheduleHour = 9` (APP_TIMEZONE, Q17), `send_task_digest` action with three buckets (overdue / due today / due this week, Q18). Supporting work: new `SendTaskDigestAction` handler in `@packages/tasks` + new `task-daily-digest` email template. Personal-queue scope mirrors Q16 semantics (own + unassigned-in-my-teams).
- [x] **D2.** Per-task overdue email — delivered by Stream B's tier-1 rules (T+0 assignee / T+0 team broadcast). No separate D2 artefact.
- [x] **D3.** Target resolution — assignee-if-set-else-team-members is covered by the B1 resolvers (`entity_field`, `org_unit_members`, `org_unit_head`, `parent_unit_head`) used by Stream B rules + the digest's `entity_field(id)` recipient (one per iterated user).

**Platform primitive introduced by Stream D (D-a):** nullable `schedule_hour` (0-23) on `automation_rules`. The schedule scanner now runs `0 * * * *` (hourly) and fires each rule only during its `scheduleHour`; NULL is treated as `DEFAULT_SCHEDULE_HOUR = 2` so rules that predate the column keep their historic once-daily-at-2am cadence without backfill. This was required because Q17 demands the digest fires at 9am APP_TIMEZONE and the previous once-daily scanner cron pinned every schedule-rule to the same hour.

### Stream E — Audit trail wiring

- [x] **E1.** Register each compliance entity with `AuditRegistryService`. All nine compliance-owned namespaces are registered in `domains/compliance/api/audit/register-compliance-audit.ts` from `ComplianceDomainModule.onModuleInit()`: the eight entity slugs (`clients`, `client-contacts`, `client-registrations`, `laws`, `compliance_rules`, `compliance-filings`, `compliance_law_handlers`, `organization`) plus the `compliance.*` custom-event namespace for generator events. Each entity registration carries an `authoriseRead` callback that delegates to the owning entity's scope-aware `findOneOrFail`, per Q23.
- [x] **E2.** Compliance services already emit `before`/`after` snapshots: the entity-engine auto-CRUD path emits `{changes, before, after}` on `Updated`, and the custom service emits in `clients.service.ts` / `client-contacts.service.ts` / `client-registrations.service.ts` carry the same shape. No new `Snapshot` interface needed — the JSONB snapshot is the payload.
- [x] **E3.** `sensitiveFields` configured per Q24: `clients.taxId` and `client-registrations.registrationNumber`. Unit-tested in `audit/__tests__/register-compliance-audit.unit.test.ts`.
- [x] **E4.** Audit trail UI is live. `apps/compliance-web` registers `AuditTimeline` as a global `DetailTabPlugin` via `extraDetailTabs`, so every entity-engine-rendered detail page gets an "Audit Trail" tab automatically. `ClientDetailPage.tsx` (a hand-built detail page that bypasses the auto-renderer) adds the tab explicitly. Visibility is enforced server-side per Q23: the audit controller consults each module's `authoriseRead`, so the timeline only returns rows the caller can already see.

**Platform changes shipped as part of E1–E3:**
- `packages/platform/audit` — `AuditModuleRegistration.authoriseRead` callback added; `audit.read` permission renamed to `audit.read_all` (firm-wide only); per-entity audit reads now delegate to the registration's callback rather than gating on a blanket permission.
- `packages/platform/entity-engine` — `buildAccessContext` exported so domain modules can build scope-aware access contexts for their `authoriseRead` callbacks without copy-pasting the JWT scope-resolution logic.

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
