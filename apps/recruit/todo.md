# Recruit ATS — UI/UX Enhancement Roadmap

Assessment date: 2026-04-08
Compared against: Ashby, Greenhouse, Lever, Workable

---

## Critical Bugs

- [x] Application detail title shows raw UUIDs instead of "Candidate -> Job Opening" (PR #642)
- [x] Offer list shows raw application UUID as the offer name (PR #644 — removed applicationId from list, use status as nameField)
- [x] "Page" in top header bar instead of current page name (PR #642)
- [x] Salary fields show "$0.00" instead of "-" for empty values (PR #642)
- [x] Redundant columns — "Job Opening" + "Posting Title", "Client" + "Client Name" show same value (PR #645 — removed nameField from listFields for job-openings, clients, vendors)
- [x] Interview names display kebab-case ("general-interview" instead of "General Interview") (PR #643)
- [x] Stage shows lowercase "offer" instead of "Offer" on detail page (PR #642)
- [x] Country codes raw — "IT" instead of "Italy" (PR #643 — field type → category, seed data fixed)
- [x] "Scheduled" and "Completed" interview statuses — already distinct (blue vs emerald in StatusBadgeRenderer)
- [x] Date format inconsistent — "Apr 7" on some pages, "12/04/2026, 17:49:44" with seconds on others (PR #642)

---

## Tier 1 — High Impact, Purpose-Built Feel

- [ ] Action-colored pipeline cards (red = needs action, yellow = awaiting feedback, gray = no action)
- [ ] Richer pipeline cards (name, source, rating, applied date, referral flag, pending action)
- [ ] Dashboard with charts and funnels (pipeline conversion, time-to-fill, source effectiveness, trends)
- [ ] Candidate profile action toolbar (Email, Schedule, Evaluate, Advance — adapts by stage/role)
- [ ] Stage-adaptive UI (actions and content change based on pipeline stage)
- [ ] Evaluation blinding (hide others' feedback until evaluator submits their own)
- [ ] Structured scorecards with forced recommendation (Def No / No / Yes / Strong Yes)
- [ ] Cross-job candidate awareness on pipeline cards

---

## Tier 2 — Polish and Professional Feel

- [ ] Collapsing detail header (minimize on scroll to maximize content space)
- [ ] Activity feed with tab filters (Notes / Emails / Activities / Feedback)
- [ ] Interview calendar view (calendar display, timezone handling, availability)
- [ ] Offer workflow (approval chains, e-signature, letter templates with auto-populate)
- [ ] Inline scheduling from candidate/application context
- [ ] Right sidebar on custom detail pages (notes, tasks, documents, other jobs)
- [ ] Smart empty field handling (hide empty fields or collapse them, no "$0.00" or "-" walls)
- [ ] Smart list views (fewer default columns, prioritize: name, status, source, last activity)

---

## Tier 3 — Modern Touches

- [ ] Candidate avatar/initials in table list views
- [ ] Keyboard shortcuts and command palette for power users
- [ ] Bulk actions bar (select multiple -> advance, reject, email, tag)
- [ ] Automation indicators on pipeline stages (lightning bolt for stages with rules)
- [ ] Role-specific views (recruiter vs hiring manager vs exec)
- [ ] Consistent date formatting (relative for recent, absolute for older)
- [ ] Remove dated fields (Fax, Skype ID)

---

## Core Problem Summary

Every screen uses the same generic pattern: search -> filter -> data table -> pagination.
Recruiters think in pipelines, candidates, and actions — not tables.

Established platforms feel purpose-built because:
1. Pipeline boards are the primary view, not tables
2. Cards signal actions needed, not just data
3. Profiles are action-oriented (what can I do?) not data-oriented (what fields exist?)
4. Context is preserved (schedule, evaluate, advance without leaving the page)
5. Analytics are integrated, not bolted on
