# Compliance V1 — Requirements

This document defines the scope of V1 of the compliance domain, as agreed with the product owner on 2026-04-22. The aim of V1 is the **minimum viable set of capabilities** a CA firm needs to run its Indian income-tax compliance practice end-to-end. Anything beyond that list is explicitly out of scope and will be picked up in later versions.

> For the design decisions and edge-case resolutions behind each requirement below, see `todos.md`.

---

## In scope

The firm administrator / accounting team should be able to:

1. **Client management** — add clients, capture contact details, status.
2. **Client registrations** — register a client against one or more laws (GST, Income Tax, TDS, PT, ROC, etc.). A client's registrations determine which compliance obligations apply to them.
3. **Compliance rule catalogue** — define recurring compliance rules for each law / sub-law (e.g., "GSTR-1, monthly, due on the 11th"), including frequency, due-date math, and grace period.
4. **Org structure** — create teams (org units), put employees in one or more teams, each with a **position** (Head / Lead / Member or admin-defined equivalents). Teams can nest via a parent–child hierarchy (division → sub-division → team).
5. **Default team assignment** — assign a default team (and optionally per-client overrides) that is responsible for every compliance rule or law. Used when tasks are generated automatically.
6. **Automatic task generation** — for every (active rule × registered client × period), the system generates a compliance task on a rolling horizon. Each task carries its rule, client, law, period start/end, and due date.
7. **Team + individual assignment** — every task is owned by a team (`assigneeTeamId`, never null). An individual (`assigneeId`) may also be assigned or may pick it up themselves; if the individual leaves or goes on leave, their individual assignment is cleared and the team retains continuous visibility.
8. **Email notifications** — the responsible team / individual receives email notifications for tasks that are **overdue** and for tasks **due within the next 7 days**. Driven by the platform's automations + notifications packages.
9. **Audit trail** — every write action on compliance entities (clients, registrations, rules, tasks, assignments, attachments, comments, status changes) is recorded with actor, timestamp, and before/after field-level diff.
10. **Files and comments on every compliance task** — any user with task access can upload supporting documents (challans, acknowledgements, computations) and add comments on a task.
11. **Escalation matrix** — every task that slips is automatically re-surfaced to higher levels of the org tree on a fixed cadence, so that no task stays invisible. Escalation **adds visibility** (notification + listing); it does not reassign ownership.
12. **Continued visibility through employee churn** — because every task is team-owned, leave, reassignment, and termination never orphan a task. Team members and team leadership always see it.

## Out of scope for V1

These are explicitly deferred:

- **Client groups** (holding / subsidiary groupings, group-level dashboards).
- **Client portal** (client-facing document intake, approval, self-service).
- **Statutory integrations** — no direct calls to ITD, GSTN, TRACES, MCA, challan gateways, or PAN/TAN validation APIs.
- **Indian tax primitives** beyond what's needed to run the rule engine — no FY/AY typing, no statutory section references, no tax-audit-specific forms (3CA/3CB/3CD, 15CA/CB), no penalty/interest computation (234A/B/C/F), no notice tracking.
- **Maker–checker / multi-step approval workflow** on tasks.
- **Sub-task decomposition** (collect → reconcile → prepare → review → file → acknowledge).
- **Revision tracking** (original vs revised return).
- **Capacity planning** — leave-aware reassignment, workload forecasting.
- **Holiday calendar** — due dates use their calendar date as-is; weekend / gazetted-holiday rolling is not applied.
- **WhatsApp / SMS** channels — only email in V1.
- **Firm-level MIS** — revenue per client, realization, practice registers.
- **Consolidated group dashboards.**

## Cross-cutting principles

- **Domain-agnostic primitives stay in packages.** Task action permissions, scope logic, org-hierarchy resolution, audit infrastructure, attachments, comments, notifications — all belong to `packages/*` and are consumed by the compliance domain. The domain only defines what is domain-specific: clients, laws, rules, task generation logic, and its own seeded roles.
- **Configuration over code.** Positions, roles, escalation cadence, rule parameters, notification templates — all expressed as data / settings, not hard-coded strings.
- **Forward-only semantics on deactivation.** Deactivating a registration, deprecating a rule, or dormantizing a client never retroactively cancels tasks that have already been generated; it only stops future generation. (Exact behaviour per field locked in `todos.md`.)
- **No domain logic leaks into packages.** Any capability that a non-compliance domain (e.g., a future deals / projects module) could reasonably want stays in a package. This is the single most important rule when deciding placement.

---

## User stories

These stories are the acceptance surface for V1. Each story has a stable ID (`US-<capability>.<n>`) so end-to-end tests can reference it: a Playwright test titled `US-1.3 dormantising a client cancels open filings` declares the story it covers, and a grep on story IDs surfaces uncovered ones.

**Terminology.** Stories use **filing** as the canonical work-unit name (the `compliance_filings` entity, post-Stream F refactor). The in-scope list above uses *task* synonymously — they refer to the same record.

**Time-driven stories.** Stories that depend on time (generator, escalation, daily digest) are written against an explicit run trigger with an `asOf` date — they exercise the handler body and date math. The scheduler-registration line is covered by a separate one-line integration test, not by these stories.

**Seed coupling.** Stories assert behaviour shape, not specific seeded rows. Where a story depends on a particular system seed (e.g., the law catalogue), it says so explicitly so seed changes can be greppped against the affected stories.

### 1. Client management

**US-1.1 Add a new client.** As a firm administrator, I want to create a client record with contact details, so I can begin tracking their compliance obligations.
- Submitting the create form with the required name field creates a client visible in the list.
- Optional fields (PAN, GSTIN, email, phone, billing address) are captured and visible on the detail page.
- New client starts in status `active`.

**US-1.2 Edit client details.** As a firm administrator, I want to update a client's contact details, so the firm record stays current.
- Editing any non-status field on the detail page persists and survives reload.
- The audit trail shows the field-level diff with actor and timestamp (US-9.2).

**US-1.3 Mark a client dormant.** As a firm administrator, I want to mark an inactive client as dormant, so the firm stops generating compliance work for them.
- Active → dormant transition succeeds.
- All non-terminal filings (`pending` / `in_progress` / `blocked`) for that client are auto-cancelled with a system comment naming the actor and date.
- The next generator sweep emits no new filings for the client.

**US-1.4 Restore a dormant client.** As a firm administrator, I want to restore a dormant client to active, so the firm can resume their compliance work.
- Dormant → active transition succeeds.
- Auto-cancelled filings are NOT recreated; future periods resume on the next generator sweep.

**US-1.5 Search and filter the client list.** As a firm administrator, I want to search and filter clients, so I can quickly find one.
- Searching by name returns matches with 300 ms debounce.
- Status and law filters narrow the list and round-trip via URL query params.

### 2. Client registrations

**US-2.1 Register a client against a law.** As a firm administrator, I want to register a client against a law (GST, Income Tax, TDS, PT, ROC), so compliance rules under that law generate filings for them.
- Selecting a law on the client's Laws tab creates a registration record with the chosen law and effective-from date.
- The next generator sweep (or event-triggered emit) produces filings for any active rule under that law.

**US-2.2 Reject registration without a resolvable handler.** As a firm administrator, I want the system to refuse registrations whose law has no handler configured, so I never create silently broken state.
- Attempting to register against a law with no handler returns an error.
- The error UI deep-links to the handler-configuration page for that law.

**US-2.3 Capture registration metadata.** As a firm administrator, I want to record the statutory registration number and effective-from date, so the firm record matches the regulator's.
- Registration number, effective-from date, and (where applicable) jurisdiction persist and render on the registration detail.

**US-2.4 Deactivate a registration (forward-only).** As a firm administrator, I want to deactivate a client's registration with an effective date, so future periods stop generating but earlier work is preserved.
- Effective date input is constrained to past or today (no future scheduling).
- Filings whose `periodStart > deactivatedAt` are auto-cancelled with reason `Registration deactivated`.
- Filings whose `periodStart <= deactivatedAt` are preserved by default.
- Toggling `Also cancel earlier in-flight filings` cancels the earlier non-terminal filings with a distinct reason for audit-intent reconstruction.
- The generator emits no new filings under the registration after `deactivatedAt`.

### 3. Compliance rule catalogue

**US-3.1 Define a compliance rule.** As a firm administrator, I want to define a recurring rule (e.g., "GSTR-1, monthly, due on the 11th"), so the system generates filings for every registered client.
- Required fields (law, name, frequency, due-date math, grace period) save the rule visible in the rules list under its law.
- Rule starts in status `draft`; only `active` rules drive generation.

**US-3.2 Activate a rule.** As a firm administrator, I want to transition a rule from draft to active, so the generator includes it on the next sweep.
- Activation requires a non-empty due-date math configuration; the workflow blocks otherwise.
- After activation, the next sweep emits filings for every client registered against the rule's law.

**US-3.3 Edit rule parameters (forward-only).** As a firm administrator, I want to edit a rule's parameters mid-period, so I can correct mistakes without rewriting historical filings.
- Mutable fields (description, grace period) edit cleanly.
- Cadence-shaping fields (frequency, due-date math) are blocked from edit when filings already exist for the rule's current period; the UI offers a "create a new rule version" path.
- Already-generated filings retain their original due date.

**US-3.4 Deprecate a rule.** As a firm administrator, I want to deprecate a rule that no longer applies, so the generator stops emitting it on the next sweep.
- Deprecation flips status to `deprecated`; the workflow history records the transition.
- Toggling `Also cancel in-flight filings` bulk-cancels open filings under the rule with reason `Rule deprecated`.
- The next sweep skips deprecated rules.

### 4. Org structure

**US-4.1 Create a team.** As a firm administrator, I want to create a team (org unit), so I can group employees who share compliance responsibility.
- Submitting the create form with required fields creates a team visible in the org tree.

**US-4.2 Nest teams under a parent.** As a firm administrator, I want to nest teams under a parent, so I can model division → sub-division → team.
- Selecting a parent during create or edit places the team under that parent in the tree view.
- An attempt to make a team its own ancestor is rejected.

**US-4.3 Add a member with a position.** As a firm administrator, I want to add an employee to a team with a position, so the system knows who can do what within that team.
- Member appears under the team with the selected position (Head / Lead / Member or admin-defined equivalent).
- A user can hold a position in multiple teams simultaneously.

**US-4.4 Customise positions.** As a firm administrator, I want to add or rename positions, so we can mirror the firm's actual titles.
- A new position appears in the position dropdown when assigning members and persists across reloads.

### 5. Default team assignment

**US-5.1 Set the default team for a rule.** As a firm administrator, I want a default team responsible for every rule, so generated filings have a team owner from day one.
- Setting a default team on a rule persists.
- Subsequently generated filings carry `assigneeTeamId = <default>`.

**US-5.2 Override default team per client.** As a firm administrator, I want to override the default team for a specific client, so client-bespoke ownership is honoured.
- A per-client override takes precedence over the rule default for that client's filings.
- Removing the override falls back to the rule default on the next generated filing.

### 6. Automatic filing generation

**US-6.1 Generator emits filings for active rules × registered clients × periods.** As a firm administrator, I want filings generated automatically, so I never create a recurring filing by hand.
- Running the generator after registering a client emits one filing per (rule × period) within the horizon for that client's law.
- Each filing carries rule, client, law, period start, period end, due date.
- The generator is idempotent: re-running for the same (rule × client × period) creates one row, not two.

**US-6.2 Rolling 12-month horizon.** As a firm administrator, I want filings generated on a rolling 12-month horizon, so the firm can plan ahead.
- Running the generator with `asOf: <today>` produces filings for every period whose `periodStart` falls within 12 months of today.
- Periods beyond the horizon are not pre-generated.

**US-6.3 Generator is invokable on demand with an explicit `asOf`.** As a developer, I want to run the generator at a chosen date for testing, so time-dependent behaviour is verifiable.
- `POST /admin/cron/generator/run` with `{ asOf: ISO8601 }` produces the same filings the scheduled cron would on that date.
- The endpoint is registered only when `ENABLE_TEST_HOOKS=true`.

**US-6.4 Generator triggered by registration / rule activation.** As a firm administrator, I want immediate filings when I activate a rule or register a new client, so I don't have to wait for the next nightly run.
- Registering a client against a law with active rules emits the relevant filings within the request response (or shortly after via async job).
- Activating a rule emits filings for all clients registered against that law.

### 7. Team + individual assignment

**US-7.1 Generated filings are team-owned.** As a firm administrator, I want every generated filing to have a team owner, so no filing is ever unowned.
- Every newly generated filing has a non-null `assigneeTeamId`.

**US-7.2 Individual picks up a filing.** As a team member, I want to pick up a filing assigned to my team, so colleagues can see who is working on it.
- `pickup` action sets `assigneeId` to the current user; status moves `pending` → `in_progress`.
- Filing appears as the picker's in their queue and as in-progress under that user in the team's queue.

**US-7.3 Reassign within a team.** As a team head, I want to reassign a filing from one team member to another, so I can rebalance load.
- `reassign` succeeds in `pending`, `in_progress`, `blocked`; fails in `completed` and `cancelled`.
- After reassign, `assigneeId` is the target user and `assigneeTeamId` is unchanged.

**US-7.4 Leaving the firm clears individual but preserves team.** As a firm administrator, I want a departing employee's individual assignments cleared automatically, so the team retains continuous visibility.
- Marking a user inactive clears `assigneeId` on every non-terminal filing where they are the individual assignee.
- `assigneeTeamId` is unchanged on those filings.

### 8. Email notifications

**US-8.1 Daily digest at 9am local time.** As a team member, I want a daily digest of my work, so I start the day with one email instead of many.
- `POST /admin/cron/daily-digest/run` with `{ asOf: <date> }` produces one email per recipient with three sections: **Overdue** (period in past, status non-terminal), **Due this week** (next 7 days), **Due next week** (8–14 days).
- Recipients: each user with non-terminal individual assignments, and each team's head for unassigned team filings.
- A recipient with no qualifying filings receives no email.
- The cron is registered with `cronForLocalHour(9, APP_TIMEZONE)` (asserted in a separate integration test).

**US-8.2 Overdue escalation T+0 / T+3 / T+7.** As a firm administrator, I want overdue filings to escalate on a fixed cadence, so slippage stays visible to leadership.
- `POST /admin/cron/escalations/run` with `asOf: <due+0>` emits a T+0 notification to the assignee and team head.
- `asOf: <due+3>` adds the parent team's head as a recipient.
- `asOf: <due+7>` adds the grandparent team's head.
- Each level fires at most once per filing across the cadence (idempotent on re-runs).
- `completed` and `cancelled` filings produce no escalation regardless of `asOf`.

**US-8.3 Due-soon visibility.** As a team member, I want a heads-up for filings due in the next 7 days, so I can plan the week.
- A filing whose due date is within 7 days of `asOf` appears in the daily digest's "Due this week" section.

### 9. Audit trail

**US-9.1 Every write action is auditable.** As a firm administrator, I want every write on a compliance entity recorded, so I can trace who changed what and when.
- Create / update / delete / transition / assignment / comment / attachment all produce an audit row with actor, timestamp, entity type, entity id.

**US-9.2 Field-level before/after diff on update.** As a firm administrator, I want the field-level diff for each update, so I can reconstruct the change exactly.
- Update audit rows carry `before` and `after` snapshots, restricted to the fields that actually changed.

**US-9.3 Sensitive fields are redacted.** As a firm administrator, I want passwords / tokens / other sensitive fields kept out of audit logs, so the audit log is safe to share.
- For entities with sensitive fields, audit rows show those fields as `[REDACTED]` in both `before` and `after`.

### 10. Files and comments on filings

**US-10.1 Upload an attachment to a filing.** As a team member, I want to upload supporting documents (challans, acknowledgements, computations) to a filing, so the firm record is complete.
- Uploading from the filing detail persists the file and lists it under the filing.
- Filename, size, uploader, and timestamp are visible.

**US-10.2 Delete an attachment.** As a team member, I want to remove an attachment uploaded by mistake, so the record stays clean.
- Delete removes the attachment from the list and underlying storage.
- An audit row records the delete with actor.

**US-10.3 Comment on a filing.** As a team member, I want to comment on a filing, so the team can discuss in context.
- Comments appear in chronological order under the filing detail with author, timestamp, body.

### 11. Escalation matrix

**US-11.1 Escalation walks up the org tree.** As a firm administrator, I want overdue filings re-surfaced to higher levels of the org tree on a fixed cadence, so no filing stays invisible.
- T+3 escalation includes the parent team's head as a recipient.
- T+7 additionally includes the grandparent team's head.
- A user holding multiple positions in the chain is deduplicated.

**US-11.2 Escalation adds visibility, never reassigns.** As a firm administrator, I want escalation to add visibility without changing ownership, so accountability stays with the original team.
- Escalation does not modify `assigneeTeamId` or `assigneeId` on the filing.
- The filing remains in the original team's queue with original ownership.

### 12. Continued visibility through churn

**US-12.1 Reassignment leaves the team unchanged.** As a team head, I want filings to stay in the team's queue when the individual reassigns out, so the work doesn't disappear.
- After `reassign`, `assigneeTeamId` is unchanged and the filing remains in the team's queue.

**US-12.2 Going on leave preserves the team.** As a firm administrator, I want filings on a member going on leave to fall back to team-only ownership, so coverage is automatic.
- Marking a user as on-leave clears `assigneeId` on their non-terminal filings.
- Filings remain on `assigneeTeamId`'s queue and are visible to all team members and the team head.

**US-12.3 Termination preserves continuity.** As a firm administrator, I want filings on a terminated user to remain in the team's queue, so termination never orphans a filing.
- Same outcome as US-12.2 for terminated users.
- The audit trail records the system-driven `assigneeId` clear with reason `user terminated`.

### Out of scope (no V1 stories)

These items have no V1 user story by design — see `## Out of scope for V1` above for rationale:

- Client groups (Q1) — would otherwise sit at US-1.x.
- Client portal — no client-facing actor in V1.
- Statutory integrations (ITD, GSTN, TRACES, MCA) — would otherwise sit at US-6.x and US-10.x.
- Indian tax primitives (FY/AY typing, 234A/B/C, 3CA/3CB/3CD, 15CA/CB).
- Maker–checker / multi-step approval workflow on filings.
- Sub-task decomposition (collect → reconcile → prepare → review → file → acknowledge).
- Revision tracking (original vs revised return).
- Capacity planning — leave-aware reassignment, workload forecasting.
- Holiday calendar (Q10) — calendar dates are stored and rendered as-is.
- WhatsApp / SMS notification channels.
- Firm-level MIS — revenue per client, realisation, practice registers.
- Consolidated group dashboards.
