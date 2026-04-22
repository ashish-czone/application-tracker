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
