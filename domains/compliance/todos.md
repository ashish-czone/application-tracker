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

## 2. Pending decisions

Questions still to work through before we can finalise V1 implementation. Answered one by one; each is moved into §1 on resolution.

### Q4 — Task lifecycle statuses
Simple (Pending / In Progress / Done) vs. richer (Pending / In Progress / Under Review / Filed / Done) vs. other. Ties to whether V1 has any review step at all.

### Q5 — Definition of "complete"
Is marking a task complete a pure status change, or does it require an attachment (proof of filing)? Affects UI and guard logic.

### Q6 — Client lifecycle: dormantisation
When a client moves to `dormant`, do open tasks stay, auto-cancel, or move to "on hold"?

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

- [ ] **A1.** Verify current `tasks.assigneeId` / `assigneeTeamId` schema and any XOR constraint. Tighten `assigneeTeamId` to `NOT NULL`; drop XOR if present. (Q2)
- [ ] **A2.** Define task action permission slugs (`tasks.view`, `tasks.pickup`, `tasks.reassign`, `tasks.review`, `tasks.complete`, `tasks.reopen`, `tasks.close`) as constants in the tasks package. (Q3)
- [ ] **A3.** Add a system seed in the tasks package that upserts these permissions into the permission registry. Wire into the CLI's system-seed run. (Q3)
- [ ] **A4.** Add action-level guards / service methods: `pickupTask`, `reassignTask`, `reviewTask`, `markComplete`, `reopenTask`, `closeTask`. Each enforces permission + scope + task-relationship (assignee / team member / head) checks. (Q3)
- [ ] **A5.** Expose the new action endpoints in the tasks controller with proper DTOs.
- [ ] **A6.** Verify scope-on-position integration end-to-end (position → scope, scope resolver, descendants walk). Close gaps _in the org-units / rbac packages_, not in the tasks package. (Q3 — "first implementation step")

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

### Stream Z — Finalisation

- [ ] **Z1.** Update `specs.md` and `todos.md` as decisions evolve — keep in sync.
- [ ] **Z2.** Audit pass (supervisor agent) after all streams merged: naming consistency, no domain logic leaked into packages, no addon → addon imports, test coverage, docs drift.

---

## Notes for future sessions

- Every stream above is a candidate for one or more feature branches; respect the worktree rule (`.claude/rules/use-worktrees.md`) and the one-PR-per-feature / one-commit-per-task rule.
- When a question in §2 is answered, (a) move it to §1 with reasoning, (b) unblock the dependent tasks in §3 by removing the "(Pending Qxx)" marker, and (c) commit the docs change on the same branch as the implementation it unblocks — not in a separate docs-only PR — so progress and decision history move together.
- If a new question surfaces during implementation, stop and add it to §2. Do not decide unilaterally.
