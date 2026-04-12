# Recruit App — ATS Assessment & Gap Analysis

**Date:** 2026-04-12
**Benchmark platforms:** Greenhouse, Lever, Workable, Ashby, Teamtailor
**Scope:** `apps/recruit` (NestJS API) and `apps/recruit-web` (React/Vite frontend)

This document audits the current state of the recruit app, compares it to modern production ATS platforms, and produces a prioritized punch list in two dimensions:

1. **Platform & app capabilities** — features and data model gaps
2. **UI / UX enhancements** — visual design, widgets, and flow improvements

It replaces the earlier (now-deleted) `recruit-ats-assessment.md`. Treat this as a living document — update it as features ship.

---

## 1. Current State Snapshot

### 1.1 Entities

All entities live in `apps/recruit/src/modules/*` and use the platform's `defineEntity()` API with Drizzle schemas.

| Entity | Purpose | Notable fields |
|---|---|---|
| `candidates` | Talent records | 40+ fields: contact, address, professional background, social links, resume file, skills, custom fields |
| `job-openings` | Open requisitions | Department, location, hiring manager, salary range, revenue forecast, attachments |
| `applications` | Candidate ↔ job junction | Stage workflow, source, referrer, notes, computed `averageRating` + `evaluationsCount` |
| `interviews` | Interview events | Type (phone/video/on-site/panel/technical/HR), round, video link, interviewers (multi-user), status picklist |
| `offers` | Offer packages | Compensation cents, currency, period, signing bonus, equity, timeline dates, status workflow |
| `offer-approvals` | Approval chain rows | Decision (pending/approved/rejected), approver, comment, timestamp |
| `clients` | Companies we recruit for | Billing/shipping address, industry, website, source |
| `contacts` | Client-side contacts | Title, addresses, social links, primary flag, email opt-out |
| `vendors` | Recruiting vendors | Minimal: name, email, phone, address |

### 1.2 Workflows

**Application stage machine** (`applications.config.ts` — 9 states):
`new → phone-screen → technical → on-site → final → offer → hired`, with rejection/withdrawal from any stage. Single global pipeline (no per-job variants) with a client-country discriminator for locale-specific behavior.

**Offer workflow** (5 states):
`draft → pending-approval → approved → sent → {accepted, declined, expired}`, gated by `require-offer-approvals` guard.

**Interview status** is a flat picklist (scheduled, completed, cancelled, no-show, rescheduled) — **not** a state machine.

### 1.3 Frontend surface

Custom pages shipped:

- **`DashboardPage`** — 4 KPI cards, pipeline funnel bar, source effectiveness chart, recent applications, upcoming interviews
- **`CandidateProfilePage`** — hero card (gradient avatar, contact chips, skills badges, status), 5 tabs (Overview / Applications / Notes / Files / Activity), action toolbar
- **`JobOpeningDetailPage`** — header KPIs + tabs showing applicant cards and a kanban view of stages, interviews, audit
- **`ApplicationDetailPage`** — thin wrapper over `EntityDetailPage` with contextual header actions
- **`InterviewsCalendarPage`** — calendar view, events color-coded by status/type (read-only)
- **`OfferApprovalPanel`** — approval chain visualization embedded in offer detail

Generic `EntityListPage` (table, search, filter, sort, pagination, bulk delete/export, column visibility) is used for every other list.

Custom cells/widgets: `PipelineProgressRenderer`, `RatingRenderer`, `AvatarNameCell`, `StatusBadge`, stage-color map.

### 1.4 What's working well

- Solid multi-stage workflow with guards and side-effect events
- Multi-approver offer chain with gating
- Evaluation framework with criteria and computed rating rollup
- Client-country discriminator hints at multi-region readiness
- Hero-card + tab detail pages are a clear step above generic CRUD
- Dashboard exists and has real charts, not placeholder tiles

---

## 2. Platform & App Capability Gaps

Ranked **P0 → P2** by impact on being a usable production ATS.

### P0 — Cannot seriously compete without these

**2.1 Candidate sourcing & careers page**
- No public careers page / branded job board
- No public application form (candidates can only be created by staff)
- No referral link generator, no UTM/source attribution on the public side
- No job board distribution (LinkedIn, Indeed, Glassdoor, Google Jobs schema.org)
- **Build:** `apps/recruit-careers` (public-facing Vite app), `POST /public/applications` endpoint with rate limit + CAPTCHA, `source` / `referrerId` auto-capture, job feed JSON-LD

**2.2 Resume parsing & enrichment**
- `resumeFile` exists as JSONB blob but no parser. Staff must re-type everything the candidate already submitted.
- **Build:** Integrate a parser (Affinda, Sovren, or OSS `resume-parser`) running as a queue job after upload; populate skills, experience, education, contact fields; flag low-confidence fields for review.

**2.3 Interview scorecards & feedback kits**
- Interviews capture schedule metadata only. No scorecards, no per-interviewer rubric, no structured feedback, no interview kit templates (questions to ask, things to probe).
- **Build:** `interview-kits` entity (questions + rubric per job or per stage), `interview-scorecards` entity (per-interviewer feedback on an interview), lock-after-submission, aggregate view on the application detail page. Required before transitioning past `technical`.

**2.4 Offer documents & e-signature**
- Offers are data-only. No PDF offer letter, no template, no e-signature, no candidate-facing accept/decline surface.
- **Build:** Plug `@packages/addons/document-templates` + `pdf-generator` into offers. Template per country/entity. E-signature via DocuSign / Dropbox Sign / BoldSign. Candidate portal token link (`/offers/:token/review`).

**2.5 Communication layer**
- No email templates, no 2-way email sync, no outbound email at all from the app, no bulk messaging.
- **Build:** `email-templates` config, `communication-log` entity (polymorphic on candidate/application), Gmail/Outlook sync via OAuth, IMAP fallback, thread view on candidate detail, merge-tag support (`{{candidate.firstName}}`), schedule-send, bulk-send with per-recipient personalization.

**2.6 Deeper reporting**
- Dashboard has 2 charts. A real ATS ships: time-to-hire, time-in-stage, source-of-hire conversion, funnel conversion %, offer acceptance rate, interviewer load, pass-through rate per interviewer, DEI breakdown, cost-per-hire.
- **Build:** `apps/recruit/src/modules/reports/` with pre-computed materialized views refreshed on application / offer events. Report page with date-range selector, team filter, job filter. Export to CSV.

### P1 — Expected in any team-sized ATS

**2.7 Kanban on applications list**
- Kanban view exists inside `JobOpeningDetailPage` but not as a first-class view on the applications list. Can't drag-to-transition at the global level.
- **Build:** View switcher (Table / Kanban / Calendar) on the applications list, backed by the existing workflow transition API. Use per-column WIP hints.

**2.8 Requisitions / headcount approval**
- `job-openings` jumps straight to "open". No requisition → approval → open lifecycle, no headcount budget, no hiring plan.
- **Build:** `job-openings` gets its own workflow (`draft → requested → approved → open → filled / closed`) and an approval chain entity, similar to offer-approvals. Optional `hiring-plans` entity grouping requisitions under a quarter/headcount budget.

**2.9 Automations for recruiting**
- Only 3 seeded rules (interview / offer / hire notifications). No condition builder UI, no scheduled triggers, no bulk-apply.
- **Leverage** `@packages/platform/automations` — add recruit-specific action handlers: "send email template", "move to stage", "assign to user", "create task". Ship a recipe library: auto-reject after 14 days no-response, auto-assign coordinator when interview scheduled, ping hiring manager if offer > 48h without decision.

**2.10 Collaboration — comments, @mentions, shared notes**
- Notes entity exists but no threaded comments, no @mentions, no activity feed merging notes + stage changes + emails.
- **Build:** `@mentions` in notes (markdown input from platform), notification on mention, unified activity feed on candidate/application, "following" concept so a user gets all updates on a candidate.

**2.11 Talent pool / CRM for passive candidates**
- Once rejected, a candidate is dead weight. No re-engagement, no tagging for "future consideration", no nurture campaigns, no silver-medalist pool.
- **Build:** Leverage `taxonomy` package for talent tags (e.g., "silver-medalist", "senior-ios", "remote-only"); add `talent-pools` as a saved filter + nurture schedule; batch emails via communication layer.

**2.12 Assessments & skills testing**
- No integration or internal flow for skills tests, coding challenges, take-homes.
- **Build:** `assessments` entity (type, provider, link, status, score), outbound integration stubs for HackerRank / CodeSignal / TestGorilla, attach-to-application flow, required-before-transition guard for `technical` stage.

### P2 — Nice-to-have, later

**2.13 Reference checks**
- No reference collection flow. Add `references` entity linked to application, token-based form for external referees, required-before-offer option.

**2.14 Background check integration**
- Stub integration with Checkr / Certn. Status field on application, webhook to transition on completion.

**2.15 Onboarding handoff**
- Offer `accepted` currently dead-ends. Emit `recruit.CandidateHired` → handoff to an onboarding module (not yet built) or external HRIS (BambooHR, Rippling) webhook.

**2.16 GDPR / compliance**
- No consent capture, no data retention policies, no right-to-erasure workflow, no DSAR export.
- **Build:** `consent` table on candidates, retention policies per country (link to the existing country discriminator), soft-delete + hard-delete scheduled job, self-serve DSAR export endpoint.

**2.17 Mobile-responsive layouts**
- Hero cards, tab layouts, calendars are desktop-first. Mobile breakpoint audit and a dedicated recruiter mobile flow (quick-add interview, review offer) would cover the most common on-the-go needs.

**2.18 Advanced search / candidate dedup**
- No boolean search, no fuzzy dedup on email/phone, no "merge candidate" flow.
- **Build:** pgvector-backed semantic search (already in platform roadmap), dedup check on create, merge action.

---

## 3. UI / UX Enhancements

### 3.1 Color system — move off hardcoded Tailwind

**Current problem:** Stage badges, avatar gradients, status dots are hardcoded Tailwind classes scattered across components (`bg-emerald-100 text-emerald-700`). Any rebrand requires a grep-and-replace. Dark mode is untested.

**Recommendation:** Extend `packages/core/ui` design tokens with a recruit-facing palette:

```
--stage-new         slate-500
--stage-screening   sky-500
--stage-technical   violet-500
--stage-onsite      amber-500
--stage-final       pink-500
--stage-offer       emerald-500
--stage-hired       green-600
--stage-rejected    rose-500
--stage-withdrawn   zinc-400
```

Each token exposes `-bg`, `-fg`, `-border`, `-soft` variants. All stage UI (badges, kanban columns, progress bars, dashboard funnel) reads from tokens. Verify AA contrast in both themes.

**Accent / brand layer:** Greenhouse uses a saturated green primary, Lever uses a deep violet, Workable uses blue. Current app inherits the platform slate. Consider adding a recruit-scoped `--brand-primary` token that shifts the primary CTA color so the recruit app feels distinct without forking the design system.

### 3.2 Missing widgets

| Widget | Why | Where |
|---|---|---|
| **Pipeline kanban board** | Drag-to-transition is the single most recognizable ATS interaction | Applications list, job opening detail |
| **Activity timeline** | Merges notes, stage changes, emails, interviews, offers into one feed; the heart of a candidate detail page | Candidate profile, application detail |
| **Side-by-side candidate comparison** | Hiring managers constantly compare 2–4 finalists | Applications list → select → "Compare" action |
| **Interviewer scorecard form** | Rubric + rating + text notes, lockable | Interview detail, email link for interviewers |
| **Offer letter preview panel** | Live preview of generated PDF with merge tags filled in | Offer detail right rail |
| **Unified search (⌘K)** | Jump to candidate / job / application from anywhere | App shell |
| **Sparkline KPI cards** | Dashboard cards show current value but no trend | Dashboard |
| **Stage transition drawer** | When moving stages, prompt for reason / feedback / next step, not a silent click | Any stage transition |
| **Inline editable fields** | Click a field on detail page → edit in place → save. Currently needs a modal. | Detail pages |
| **Email composer with template picker** | Slide-out from candidate detail | Candidate / application pages |
| **Bulk action bar** | Appears when rows selected: "Move to stage", "Email", "Reject", "Add tag" | Applications list |

### 3.3 Flow improvements

- **Candidate creation → application in one flow.** Today, staff create a candidate, then navigate to a job, then create an application. Collapse into a single "Apply candidate to job" dialog with candidate search / create-new tabs.
- **Auto-schedule interview on stage transition.** Moving to `phone-screen` should open the schedule-interview dialog pre-filled, not leave the user to remember.
- **Offer creation from application.** Clicking "Create offer" on an application should prefill job, candidate, hiring manager, salary band (from job-opening range) — currently a blank modal.
- **Interview feedback nudge.** Once an interview moves to `completed`, the interviewer should get an in-app + email nudge pointing at an unfilled scorecard, blocking the next stage transition if required.
- **Rejection flow with reason + template.** Rejecting a candidate should collect a reason (picklist) and offer to send a rejection email from a template. Today it's a silent state change.
- **Keyboard shortcuts.** `j`/`k` to navigate rows, `e` to edit, `s` to change stage, `/` to search, `⌘K` for global search. Ship a cheat-sheet modal via `?`.
- **Approval chain visibility on application.** Offer approval status is buried inside the offer. Surface a pill ("Offer pending 2 of 3 approvals") on the application header so recruiters don't have to dig.
- **Calendar drag-to-reschedule.** `InterviewsCalendarPage` is currently read-only. Let interviewers drag events to move them, with automatic re-notification.
- **Consistent empty states.** Every list / tab should have an illustrated empty state with a primary CTA. Today some are "No data." Add to Applications, Notes, Files, Interviews tabs.
- **Loading states via skeletons, not spinners.** Detail pages currently flash spinners. Replace with skeleton hero + skeleton tab content for perceived speed.
- **Stage progress bar on application detail.** Show the full pipeline as a horizontal stepper at the top of an application, not only in list cells.

### 3.4 Information density

- **Applications list.** Today: stage, candidate name, job, date. Add: interviewer(s), next scheduled event, offer status indicator, days-in-stage pill. Each row should let a busy recruiter scan pipeline health without opening the row.
- **Candidate detail hero.** Today: name, contact, skills, status. Add: applied jobs count, last activity timestamp, source, recruiter/owner avatar, "following" toggle.
- **Job opening detail.** Today: KPIs, pipeline cards. Add: days-open, cost-per-applicant (when we have sourcing data), hiring manager SLA, open-to-hire forecast.

### 3.5 Accessibility & polish

- Stage color map is the ONLY signal for stage — add icons so it works for color-blind users.
- Focus rings on custom cells (avatar, status badge) are inconsistent; standardize via the ring utilities in `packages/core/ui`.
- `aria-live` announcements on stage transitions and bulk actions.
- Dark mode audit of all custom color maps.

---

## 4. Suggested Sequencing

Ship as small PRs grouped by theme. Rough order:

1. **Design tokens + kanban on applications list** (P1, P0 polish) — unblocks visual consistency and delivers a flagship interaction.
2. **Activity timeline + inline edit + stage-transition drawer** (P0 UX) — the candidate detail becomes the workbench.
3. **Communication layer v1** (P0 capability) — email templates, outbound send, template picker. Unlocks rejection flow, bulk outreach, offer letters.
4. **Offer documents + e-signature** (P0 capability) — build on communication layer and `pdf-generator`.
5. **Interview scorecards + kits + feedback blocking** (P0 capability).
6. **Reporting v2** (P0 capability) — materialized views, funnel, time-to-hire.
7. **Careers page + public application** (P0 capability) — new sub-app.
8. **Resume parsing** (P0 capability) — background job integration.
9. **Requisitions / approvals, automations recipe library, talent pools** (P1).
10. **References, background checks, onboarding handoff, GDPR, mobile, dedup** (P2).

Each theme is further decomposed into atomic tasks during its own planning pass.

---

## 5. Decisions Still Needed

Before any of the above turns into code, the user should weigh in on:

- **Build vs buy for communication** — custom email sync or wrap a provider (Postmark, Customer.io, Loops)?
- **E-signature vendor** — DocuSign (expensive, ubiquitous), Dropbox Sign, BoldSign, or OSS (documenso)?
- **Resume parser vendor** — Affinda (commercial, high accuracy), Sovren, or OSS (`resume-parser`, `pyresparser`)?
- **Public careers page as a new Vite app or as a public route in `recruit-web`?**
- **Does the recruit app ship its own brand color**, or does it stay on the platform's slate?
- **Is multi-tenancy a constraint now** — does the careers page need tenant-scoped routing (`/t/:tenantSlug/jobs`)?

None of the P0 items should start without an answer here.

---

## 6. Phased Delivery Plan

This section is the **living task tracker** for the assessment. Every phase below is a self-contained body of work. Within a phase, tasks are atomic — each maps to one commit, and a phase ships as one PR (or a small number of PRs at natural seams). Update status in place as work lands; link the merged PR next to each task when it's done.

**Status legend:**
- `[ ]` — not started
- `[~]` — in progress
- `[x]` — done (include PR link: `(#729)`)
- `[-]` — skipped / no longer needed (include one-line reason)

**How to update this file:**
1. When starting a phase, flip its status to `In progress` and list the branch name.
2. When a task ships, flip its checkbox to `[x]` and append the PR number.
3. When a phase is fully shipped, flip its status to `Shipped (YYYY-MM-DD)` and add a one-line retrospective under "Notes".
4. If scope changes, edit the task list in place and leave a dated note under "Notes". Do not rewrite history.

---

### Phase 0 — Open Decisions (blocks all P0 work)

**Status:** Not started
**Owner:** User
**Outputs:** Answers recorded inline in section 5 of this doc

Decisions needed before any code is written in P0 phases:

- [ ] Communication layer: build custom email sync or wrap a provider (Postmark / Customer.io / Loops / Resend)
- [ ] E-signature vendor: DocuSign / Dropbox Sign / BoldSign / Documenso (OSS)
- [ ] Resume parser: Affinda / Sovren / OSS (`resume-parser`, `pyresparser`)
- [ ] Careers page shape: new Vite sub-app vs public routes in `recruit-web`
- [ ] Recruit brand color: own primary token or inherit platform slate
- [ ] Multi-tenancy scope: does careers page need tenant-scoped routing now

**Notes:**
- _empty_

---

### Phase 1 — Design Tokens + Kanban on Applications

**Status:** Not started
**Dependencies:** Phase 0 decision on recruit brand color
**Goal:** Replace hardcoded stage colors with design tokens, and deliver a drag-to-transition kanban as a first-class view on the applications list.

Tasks:

- [ ] Add stage design tokens to `packages/core/ui` theme (`--stage-*` with `-bg`, `-fg`, `-border`, `-soft` variants) — verify AA contrast in light and dark mode
- [ ] Migrate `StatusBadge`, `PipelineProgressRenderer`, stage color map on `JobOpeningDetailPage`, dashboard funnel bar to read from tokens
- [ ] Grep-verify no `bg-emerald-100`-style stage literals remain in `apps/recruit-web/src/portals/recruiter/features/`
- [ ] Add view-switcher control (Table / Kanban) to the applications list page
- [ ] Build reusable `<KanbanBoard>` widget in `packages/platform/entity-engine-ui` (generic over entity + workflow field) — drag source, drop target, column WIP badges
- [ ] Wire applications kanban to existing workflow transition API; optimistic update + rollback on error
- [ ] Per-column card shows: candidate avatar + name, job, days-in-stage pill, next scheduled event
- [ ] Empty / loading / error states for the board
- [ ] E2E: drag card across columns, verify stage persists, verify workflow guards still block illegal transitions
- [ ] Keyboard accessibility: arrow-key navigation between cards, space to pick up / drop, screen-reader announcements

**Notes:**
- _empty_

---

### Phase 2 — Activity Timeline, Inline Edit, Stage-Transition Drawer

**Status:** Not started
**Dependencies:** None (orthogonal to Phase 1)
**Goal:** Turn the candidate / application detail page into a true workbench — unified activity feed, fewer clicks to edit, structured stage transitions.

Tasks:

- [ ] Extend audit event stream → polymorphic `activity` feed query (merges notes, stage changes, interviews created, offers sent, emails — email rows become real in Phase 3)
- [ ] Build `<ActivityTimeline>` component in `packages/platform/entity-engine-ui` (reverse-chronological, grouped by day, icon per event type)
- [ ] Replace generic audit tab on `CandidateProfilePage` with `ActivityTimeline`
- [ ] Add `ActivityTimeline` to application detail, offer detail
- [ ] Inline editable fields on detail pages — click field → inline edit → save on blur / enter; uses existing `DynamicField` under the hood
- [ ] Field-level permission check before showing edit affordance (hook into existing RBAC field-level perms)
- [ ] Stage-transition drawer: intercept every workflow transition on applications, collect `reason` (picklist), `note` (markdown), optional `nextStepAction` (e.g., schedule interview, send rejection email — email in Phase 3)
- [ ] Persist transition reason as part of the workflow event payload; surface in activity timeline
- [ ] E2E: transition a candidate through 3 stages via the drawer, verify reasons appear in activity feed
- [ ] Stage progress bar (horizontal stepper) on application detail header

**Notes:**
- _empty_

---

### Phase 3 — Communication Layer v1

**Status:** Not started
**Dependencies:** Phase 0 decision on email provider
**Goal:** Outbound email with templates, merge tags, and a per-candidate thread view. Unlocks rejection flow, bulk outreach, and offer letter delivery.

Tasks:

- [ ] New addon package `packages/addons/communication` — provider abstraction (SMTP / Postmark / Resend / Gmail API), send queue, bounce/complaint webhook handler
- [ ] `email-templates` entity (name, subject, body markdown, entity context, tags) — admin-editable via existing layout system
- [ ] Merge-tag renderer with safe escaping (`{{candidate.firstName}}`, `{{job.title}}`) — resolve via entity-engine's field accessors
- [ ] `communication-log` entity — polymorphic on candidate / application, stores direction, subject, body, status (queued / sent / delivered / opened / bounced)
- [ ] Outbound send service + queue job; emit `communication.EmailSent` event for activity timeline
- [ ] Email composer slide-out: template picker, preview pane, merge-tag resolution, schedule-send
- [ ] Thread view on candidate profile (Emails tab) — list of sent/received messages
- [ ] Bulk send from applications list (with per-recipient personalization preview)
- [ ] Rate limiting + per-user daily cap + tenant-scoped sender domain validation
- [ ] Security tests: 401/403 on send, template ownership, merge-tag injection prevention
- [ ] E2E: send a templated email from candidate detail, verify activity timeline entry, verify bounced status transitions

**Out of scope for v1:** 2-way inbound email sync (IMAP/Gmail push). Defer to v2.

**Notes:**
- _empty_

---

### Phase 4 — Offer Documents + E-Signature

**Status:** Not started
**Dependencies:** Phase 3 (email delivery), Phase 0 decision on e-sign vendor
**Goal:** Generate offer letter PDFs from templates, send via email, collect e-signature, update offer status on signed.

Tasks:

- [ ] Offer letter template entity — markdown body + header/footer + per-country variant, uses `@packages/addons/document-templates`
- [ ] Render offer letter via `@packages/addons/pdf-generator` on offer transition to `approved`
- [ ] Preview panel on offer detail — live PDF render with current field values
- [ ] E-sign provider abstraction (vendor decided in Phase 0) — envelope create, webhook for signed/declined
- [ ] Candidate-facing review page `/offers/:token/review` — token-gated, shows PDF, accept/decline CTA, signature capture
- [ ] Status sync: `sent → accepted / declined` driven by webhook
- [ ] Email template "offer-sent" wired to send on transition to `sent`, body contains token link
- [ ] Activity timeline entries for offer events
- [ ] E2E: create offer → approve → send → open candidate link → sign → verify status transitions and PDF archived

**Notes:**
- _empty_

---

### Phase 5 — Interview Scorecards + Kits + Feedback Gating

**Status:** Not started
**Dependencies:** None (parallel to Phase 3/4 if capacity allows)
**Goal:** Structured interview feedback with rubrics, required before advancing stages past `technical`.

Tasks:

- [ ] `interview-kits` entity — name, job (optional), stage, questions list, rubric criteria with weights
- [ ] `interview-scorecards` entity — per-interviewer on an interview, answers + ratings + overall recommendation (strong-yes / yes / no / strong-no)
- [ ] Lock-after-submission behavior on scorecards
- [ ] Scorecard form component in `packages/platform/entity-engine-ui` — renders kit, collects feedback
- [ ] Interview detail page redesign: kit preview, per-interviewer scorecard status, aggregate summary
- [ ] Email / in-app nudge to interviewer when interview status → `completed` and their scorecard is empty
- [ ] Workflow guard: block transition past `technical` if any scorecard required-and-missing on the latest interview
- [ ] Aggregate scorecard view on application detail (collapsible panel per interview)
- [ ] E2E: schedule interview → complete → submit scorecards → verify gate releases stage transition

**Notes:**
- _empty_

---

### Phase 6 — Reporting v2

**Status:** Not started
**Dependencies:** Phases 1–5 ship meaningful data first
**Goal:** Operational reports that recruiting leads actually use: time-to-hire, funnel conversion, source effectiveness, offer acceptance.

Tasks:

- [ ] `recruit/reports` module in `apps/recruit/src/modules/`
- [ ] Materialized views: time-in-stage, time-to-hire, funnel conversion, offer acceptance rate, source-of-hire, interviewer load
- [ ] Refresh strategy — scheduled + event-driven (refresh on application / offer events)
- [ ] Report query API with date range, team, job filters
- [ ] Reports page (`/reports`) with tab per report, date range picker, team/job filters, export to CSV
- [ ] Sparkline KPI cards on dashboard (current value + 30-day trend)
- [ ] DEI breakdown report (requires self-reported demographics, GDPR-aware — flag dependency on Phase 10)
- [ ] E2E: generate report over fixture data, export CSV, verify filter persistence in URL

**Notes:**
- _empty_

---

### Phase 7 — Careers Page + Public Applications

**Status:** Not started
**Dependencies:** Phase 0 decision on sub-app shape, Phase 3 (to send "application received" email)
**Goal:** Public-facing job board where candidates can apply without staff intervention.

Tasks:

- [ ] New app or public route (per Phase 0 decision) with job list and job detail page
- [ ] JSON-LD `JobPosting` schema on job detail pages for Google Jobs indexing
- [ ] Public `POST /public/applications` endpoint — rate-limited, CAPTCHA, honeypot, file upload
- [ ] Source attribution — capture UTM params, referrer, store on created application
- [ ] Referral link generator for staff — `?ref=<userId>`
- [ ] Candidate-facing "application submitted" confirmation page + templated confirmation email (Phase 3 dependency)
- [ ] Admin control over which jobs are published publicly (`publishedAt` / `unpublishedAt` on job opening)
- [ ] SEO basics: title, description, OG image per job
- [ ] E2E: submit a public application, verify it arrives in the internal list with correct source attribution

**Notes:**
- _empty_

---

### Phase 8 — Resume Parsing

**Status:** Not started
**Dependencies:** Phase 0 decision on parser vendor, Phase 7 (public apps benefit most)
**Goal:** Extract structured data from uploaded resumes and prefill candidate fields.

Tasks:

- [ ] Parser provider abstraction in `packages/addons/communication` or a new `packages/addons/resume-parser`
- [ ] Queue job: on resume upload → parse → write structured fields (skills, experience, education, contact)
- [ ] Confidence score per field, flag low-confidence for staff review
- [ ] UI affordance on candidate form: parsed fields show a small "parsed" badge that clears on first edit
- [ ] Retry + failure surface in the job queue dashboard
- [ ] Optional: on public application submission, run parser synchronously for small files
- [ ] E2E: upload sample resume fixture, verify fields populated

**Notes:**
- _empty_

---

### Phase 9 — P1 Bundle: Requisitions, Automations Recipes, Collaboration, Talent Pool, Assessments

**Status:** Not started
**Dependencies:** Phases 1–8 provide the substrate
**Goal:** Round out the recruiter experience with workflow automation, pre-hire assessments, and passive-candidate nurture.

Tasks (decompose into sub-phases when scheduled — each bullet is roughly a sub-phase):

- [ ] Requisitions / hiring plans — job-opening workflow `draft → requested → approved → open → filled / closed`, approval chain reusing offer-approvals pattern, `hiring-plans` entity grouping by quarter/budget
- [ ] Automations recipe library — ship 5–10 recipes using `@packages/platform/automations`: auto-reject after N days no-response, auto-assign coordinator on interview schedule, nudge hiring manager on stale offer, auto-tag candidates with "silver medalist" on rejection after final round, etc.
- [ ] Collaboration: `@mentions` in notes (markdown input), notification on mention, "following" concept, unified activity feed improvements
- [ ] Talent pool / CRM: saved filter + tag-based segments, nurture email schedule (built on communication layer), silver-medalist auto-tag
- [ ] Assessments integration: `assessments` entity, outbound stub for HackerRank / CodeSignal / TestGorilla, attach-to-application flow, required-before-transition guard
- [ ] Side-by-side candidate comparison view (select 2–4 from applications list → Compare action)
- [ ] Global search (⌘K) over candidates / jobs / applications
- [ ] Bulk actions on applications list — mass stage transition, bulk email, bulk reject, bulk tag

**Notes:**
- _empty_

---

### Phase 10 — P2 Bundle: Compliance, References, Background, Onboarding, Mobile, Dedup

**Status:** Not started
**Dependencies:** Phase 9
**Goal:** Enterprise-readiness features and edge cases.

Tasks:

- [ ] References: `references` entity, token-based external referee form, optional required-before-offer gate
- [ ] Background checks: integration stub (Checkr / Certn), status on application, webhook-driven transition
- [ ] Onboarding handoff: `recruit.CandidateHired` event → webhook to external HRIS (BambooHR / Rippling) or placeholder for internal onboarding module
- [ ] GDPR: consent capture on candidates, retention policies per country (leverages client-country discriminator), soft-delete + scheduled hard-delete job, self-serve DSAR export endpoint, right-to-erasure workflow
- [ ] Mobile-responsive audit: hero cards, tab layouts, calendar, kanban — add breakpoints, dedicated mobile quick-add interview and review-offer flows
- [ ] Candidate dedup: fuzzy match on email/phone during create, merge-candidate flow, pgvector-backed semantic search (ties into platform semantic search roadmap)
- [ ] Accessibility audit pass: icon + color for stages (not color-only), consistent focus rings, `aria-live` on transitions and bulk actions, dark mode verification
- [ ] Interview calendar drag-to-reschedule with re-notification

**Notes:**
- _empty_

---

### Cross-Cutting Continuous Work

Things that don't belong to one phase — pick up opportunistically while working in the area:

- [ ] Empty states with illustration + CTA on every list / tab
- [ ] Skeleton loading states replacing spinners on detail pages
- [ ] Consolidate hardcoded Tailwind color literals as they're encountered
- [ ] Storybook / component gallery for new shared widgets (`KanbanBoard`, `ActivityTimeline`, scorecard form)
- [ ] Keep this document in sync after every shipped task — status, PR link, notes

---

## 7. Change Log

| Date | Change | PR |
|---|---|---|
| 2026-04-12 | Initial assessment and phased plan | #729 |
