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
