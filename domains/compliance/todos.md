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

---

## 2. Pending decisions

Questions still to work through before we can finalise V1 implementation. Answered one by one; each is moved into §1 on resolution.

### Q7 — Multiple registrations against the same law
Can one client have two registrations against the same law (e.g., two GSTINs for two states)? If yes, are tasks generated per registration or per (client, law)?

### Q8 — Forward-only semantics on deactivation
Confirm: deactivating a registration or deprecating a rule leaves already-generated tasks unaffected; only future generation stops. Need to also decide how this is communicated in the UI.

### Q9 — Rule parameter changes mid-period
If due-date math changes on an active rule, do already-generated future tasks recompute or stay with their original dates?

### Q10 — Weekend / public-holiday handling on due dates
Calendar date as-is vs. roll to next working day vs. track both.

### Q11 — Task generation horizon
Current code uses 6 months. Keep, extend, or make configurable?

### Q12 — Task generation trigger
Nightly cron, event-driven (on rule/registration create + periodic top-up), or both?

### Q13 — Missing handler behaviour
If a client is registered for a law but no law-handler (default team) is configured, do we generate the task with null team + admin alert, or block generation?

### Q14 — Scope → position mapping at seed time
What scope does each seeded position (Head, Lead, Member) carry by default? (Likely: Head → `unit`, Lead → `own`, Member → `own`; Division Head → `descendants`; Firm Admin → `all`.) Needs a single pass to confirm defaults.

### Q15 — Role ↔ permission seed composition
Exactly which permissions does each seeded role (Preparer / Reviewer / Team Lead / Firm Admin) hold? First-cut table below needs confirmation.

| Role        | view | pickup | reassign | review | complete | reopen | close |
|-------------|:----:|:------:|:--------:|:------:|:--------:|:------:|:-----:|
| Preparer    |  ✅  |   ✅   |          |        |    ✅    |        |       |
| Reviewer    |  ✅  |   ✅   |          |   ✅   |    ✅    |        |       |
| Team Lead   |  ✅  |   ✅   |    ✅    |   ✅   |    ✅    |   ✅   |   ✅  |
| Firm Admin  |  ✅  |   ✅   |    ✅    |   ✅   |    ✅    |   ✅   |   ✅  |

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

### Stream C — Compliance domain role & permission seeds

- [ ] **C1.** System seed: default roles (Preparer, Reviewer, Team Lead, Firm Admin) with their permission sets. Added to `complianceSystemSeedSources()` in `domains/compliance/api/seeds.ts`. (Q3, pending Q15 for exact permission list)
- [ ] **C2.** Demo seed: sample user ↔ role assignments reflecting a realistic small firm. (Q3)

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

### Stream I — Client lifecycle handling

- [ ] **I1.** Hook on the `client.status → dormant` workflow transition that bulk-cancels all non-terminal `compliance_tasks` for the client, attaching a system comment (`"Auto-cancelled: client <Name> dormantised on <date> by <actor>"`). Transactional with the transition. (Q6)
- [ ] **I2.** Ensure `GenerateComplianceTasksAction` filters on `client.status = 'active'`. Verify if already present; add if not. (Q6)
- [ ] **I3.** UI prompt on the dormancy transition showing the number of tasks that will be cancelled, with an explicit confirmation. (Q6)

### Stream Z — Finalisation

- [ ] **Z1.** Update `specs.md` and `todos.md` as decisions evolve — keep in sync.
- [ ] **Z2.** Audit pass (supervisor agent) after all streams merged: naming consistency, no domain logic leaked into packages, no addon → addon imports, test coverage, docs drift.

---

## Notes for future sessions

- Every stream above is a candidate for one or more feature branches; respect the worktree rule (`.claude/rules/use-worktrees.md`) and the one-PR-per-feature / one-commit-per-task rule.
- When a question in §2 is answered, (a) move it to §1 with reasoning, (b) unblock the dependent tasks in §3 by removing the "(Pending Qxx)" marker, and (c) commit the docs change on the same branch as the implementation it unblocks — not in a separate docs-only PR — so progress and decision history move together.
- If a new question surfaces during implementation, stop and add it to §2. Do not decide unilaterally.
