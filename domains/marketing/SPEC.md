---
title: Marketing — Spec & Roadmap
status: v1 architecture decisions locked (updated 2026-04-30); ready for task breakdown
owners: product
target_user: single-owner software-services founder (this codebase's primary operator)
decisions:
  - 2026-04-30 — domain shape is a personal marketing OS, not a multi-tenant marketing automation platform. Solo-operator workflows beat enterprise feature parity.
  - 2026-04-30 — V1 = inbound monitoring + light CRM + case-study library. Outbound publishing automation deferred to V2; existing tools (Buffer/Typefully/Postiz) are good enough until the in-house composer is genuinely better.
  - 2026-04-30 — channels in scope skew B2B-software: LinkedIn, Twitter/X, Reddit, Hacker News, Dev.to, Hashnode, GitHub, Indie Hackers, Product Hunt, agency directories (Clutch / GoodFirms / DesignRush). Instagram, Facebook, TikTok, Shopify Forums explicitly out of scope.
  - 2026-04-30 — one consolidated `marketing` domain. CRM and social are NOT split out preemptively. Internal feature folders (`monitoring/`, `leads/`, `case-studies/`, `templates/`, `digest/`, later `composer/`, `publishing/`) pre-figure where future splits would land if/when a real second consumer or sales-pipeline scope appears. `marketing_leads.source_item_id` stays as a real FK to `marketing_items` (no text-only attribution downgrade).
  - 2026-04-30 — Q1 app layer = feature folder under `apps/agency/ui/portals/admin/features/marketing/`. No new app. No new portal.
  - 2026-04-30 — Q2 service approach = all V1 services hand-written, NOT using `entity-engine`. Domain wires platform integrations explicitly: `RbacIntegrationModule.forFeature({ manifests: [...] })` declares permissions, controllers carry `@RequirePermission('marketing.action')` decorators, services emit events via `domainEventEmitter.emit(EVENT_CONST, payload)` (audit/automations/notifications subscribe), polling lives in `<feature>/jobs/` files, side-effect listeners in `<feature>/listeners/`. Reference precedent: `packages/platform/settings`. Library-style composition; no framework auto-wiring. Common entity-list UI primitives are reused where sensible; add/update forms are hand-coded.
  - 2026-04-30 — Q3 polling = queue-based recurring jobs via `packages/platform/queue`. Per-source repeat schedules. No in-process `@Cron`; survives crashes, distributable, retry/DLQ for free.
  - 2026-04-30 — Q4 source credentials = environment variables for V1 read-only monitoring (Reddit client_id/secret, RSS user-agent). The `oauth` addon enters in V2 when publishing-as-user (LinkedIn / Twitter / Dev.to / Hashnode) needs user-context tokens.
  - 2026-04-30 — Q5 form-to-lead REVISED = events+listener (sub-option 5.2). Marketing owns its own form-capture: `marketing_form_submissions` table + public `POST /api/marketing/form-submissions` controller. Service emits `marketing.form_submission.created`; listener at `marketing/leads/listeners/create-lead-from-submission.listener.ts` reacts and creates the lead. Reasoning correction: lead creation is NOT an invariant-maintaining state mutation — the submission row is the durable source of truth, the lead is a downstream operator-side projection. Form submitter sees "thanks" confirmation; lead surfaces in operator inbox seconds later. Open-closed for future reactions (Slack notify operator, score lead, etc.) without changing form-submission code. The earlier subclass-composition framing was overcorrected — there is no `landing-pages` addon to subclass anyway. Mitigations: idempotent listener keyed on submission_id, DLQ + alerting, `marketing:backfill-leads-from-submissions` reconciliation job.
  - 2026-04-30 — Q6 digest rendering = marketing owns rendering (bespoke layout, in-domain React/string components), `notifications` addon is delivery transport only. Digest is sent with `kind: 'marketing.digest'` so the notifications addon can track delivery / suppression / preferences specifically.
  - 2026-04-30 — Q7 outreach send = copy-to-clipboard / open-in-tab. No direct LinkedIn DM API (doesn't exist for personal accounts). No SaaS-SMTP for outreach email (worse deliverability than personal Gmail send). Operator pastes + sends manually, then confirms with "I sent it" → records `marketing_lead_events.kind = 'message_sent'` and optionally bumps lead status `new → contacted`.
  - 2026-04-30 — reactive/scheduled-work mechanism layering: (a) **automations addon** for end-user-configurable rules, (b) **queue jobs** in `<feature>/jobs/<name>.job.ts` for developer-defined scheduled work, (c) **events + listeners** in `<feature>/listeners/<name>.listener.ts` for code-defined side effects, (d) **subclass composition** for cross-domain state mutation that's part of the operation's purpose. Domain services NEVER import `queue` or `notifications` directly — only `jobs/` and `listeners/` files do. Listeners are stateless reactions; failure never rolls back the originating service call. Default: developer-defined for V1, promote to automation-addon rule when end-users need configurability.
---

# 1. Product vision

A **personal marketing OS** for a single-owner software-services founder. The job-to-be-done: spend **30 minutes a day** on marketing instead of two hours, and never miss a lead-shaped conversation.

The system replaces the daily ritual of opening LinkedIn, Reddit, Hacker News, Twitter, Dev.to, Indie Hackers, etc. tab-by-tab with a single inbox, and replaces ad-hoc lead notes with a tracked pipeline.

**Principles**

- **Solo-first, not enterprise.** Workflows assume one operator. No multi-user assignments, no role hierarchies inside marketing, no approval chains.
- **Time-budgeted UX.** Every screen targets a specific time block in the daily loop (digest review = 10 min, composer = 10 min, pipeline = 5 min, outbound = 10 min). If a feature can't fit a slot, it's V3+.
- **Compose-on-top, not rebuild.** Use existing addons (`workflows`, `notifications`, `landing-pages`, `categories/taxonomy`) and shared identity tables (`clients`, `client_contacts`). Don't reinvent.
- **B2B-software channel mix.** Channels are picked for software-services lead intent. We do not chase visual-content channels (Instagram, TikTok) or low-B2B-intent channels (Facebook).
- **Inbound > outbound.** A relevant Reddit thread converts better than a cold DM. Monitoring is the highest-leverage capability — built first.

**What this is NOT**

- Not HubSpot Marketing Hub, Marketo, or Zoho Marketing Automation. We are not building drip-sequence engines, ABM, predictive scoring, or multi-touch attribution.
- Not a CRM. The CRM domain (`domains/crm/`, future) owns the sales pipeline. Marketing only tracks **lead capture** up to the point a lead is qualified and handed off.
- Not a social media manager. We compose and (V2+) publish, but we don't replicate Buffer/Hootsuite analytics dashboards.
- Not a CMS. Blog posts and landing pages live in their respective domains/addons. Marketing references them, doesn't host them.

# 2. Target user

A single founder running a software-services business. Sells: web apps, SaaS MVPs, custom React/Node/TypeScript work, technical consulting. Has:

- A small portfolio of past projects (case studies)
- A handful of testimonials
- Limited time (30 min/day on marketing, max)
- No marketing team, no agency, no SDR
- A LinkedIn, Twitter, Dev.to, GitHub profile already
- Listings (or wants listings) on Clutch, GoodFirms, DesignRush, etc.

The system optimizes for **this user**. Future expansion to multi-user / agency-internal use is V3+ and not a V1 constraint.

# 3. Channels — what's in, what's out

## 3.1 In scope

| Channel | Why for software services | Capability tier |
|---|---|---|
| **LinkedIn (personal)** | #1 B2B channel for agencies/consultants | Monitor + Compose + (V2) Publish via 3rd-party |
| **Twitter / X** | Devs hang out here; tech takes, threads | Monitor + Compose + (V2) Publish (paid API) |
| **Reddit** | r/webdev, r/SaaS, r/forhire, r/Entrepreneur, r/sideproject — high lead intent | Monitor (free API) + Compose |
| **Hacker News** | Show HN launches, thoughtful comments on relevant threads | Monitor (Algolia API) + Compose |
| **Dev.to** | Technical blog posts, dev audience, SEO-friendly | Monitor + Compose + (V2) Publish |
| **Hashnode** | Technical blog posts, dev audience | (V2) Publish |
| **GitHub** | Profile / pinned repos / README — passive lead magnet | Profile-tracker only |
| **Indie Hackers** | Solo founder community, milestones | Monitor + Compose |
| **Product Hunt** | One-time launches | (V3) Launch checklist |
| **Clutch / GoodFirms / DesignRush** | Agency directories — RFP-style inbound | Directory presence tracker |
| **Industry Slack/Discord** | Niche tech communities | (V3) Manual log + reminder |

## 3.2 Out of scope (permanently, for this domain)

- **Instagram** — low B2B intent; visual-content cost is high; software services don't convert here
- **Facebook (Pages, Groups)** — B2B services barely convert; Meta API friction high
- **TikTok** — signal-to-noise too low for B2B services
- **Pinterest, YouTube Shorts** — wrong format
- **Shopify Forums** — only useful if niching into Shopify dev (not in this user's positioning)

If the user's positioning ever requires these, they are added explicitly via a new SPEC revision — not silently re-scoped in.

# 4. Daily loop (the UX target)

The product is designed around this loop. If a feature doesn't slot into one of these blocks, it's V3+ at best.

| Time | Block | Feature surface |
|---|---|---|
| 08:00 | Digest review (10 min) | Open digest email → click 3-5 monitoring items worth engaging → respond directly on the source platform |
| 08:10 | Compose (10 min) | One post, channel-tagged variants, schedule across 2-3 channels |
| 08:20 | Pipeline (5 min) | Check leads, send 2 follow-ups, log new lead from a DM |
| 08:25 | Outbound (5 min) | 2-3 cold messages using prefilled templates with case study links |

Anything outside this loop is **batched weekly** (Sunday 30 min): refresh case study library, update directory profiles, review recycle queue, plan next week's posts.

# 5. Versioned roadmap

## V1 — Foundation (the part of the loop that pays back fastest)

**Theme:** *Stop browsing. Start engaging. Track every lead.*

The minimum viable system that replaces the daily browsing ritual and the "lead noted in a Notion doc" anti-pattern.

| # | Feature | Notes |
|---|---|---|
| 1.1 | **Monitoring sources** | Reddit (free API), Hacker News (Algolia API), RSS feeds. Source records with auth tokens, polling cadence, last-fetched timestamp. |
| 1.2 | **Keyword watchers** | User-defined keyword/phrase rules per source. Service-aligned defaults: `"need developer"`, `"hiring agency"`, `"react developer"`, `"saas mvp"`, `"web app rebuild"`, `"freelance dev"` |
| 1.3 | **Monitoring inbox** | Items list, newest-first, filter by source/keyword. Per-item actions: `engaged`, `dismissed`, `convert to lead`, `snooze N days` |
| 1.4 | **Daily digest email** | One email at user-configured time (default 08:00 local). Top N items per source. Sent via existing `notifications` addon. Skipped if no items above threshold. |
| 1.5 | **Light CRM — leads** | Lead entity: name, email, source, channel, original context (URL + snippet), service interest, status (`new` → `contacted` → `qualified` → `proposal` → `won`/`lost`/`dormant`). Notes timeline. |
| 1.6 | **Outreach templates** | Reusable cold/follow-up message templates, keyed by `service` + `source`. One-click "copy with variables filled in" (lead name, source URL, relevant case study link). |
| 1.7 | **Follow-up reminders** | Per-lead reminder set: "ping in N days if no reply". Daily reminder digest in the same 08:00 email. |
| 1.8 | **Case study library** | Case study entity: client (anonymisable), problem, solution, tech stack, outcome, screenshots, testimonial, link to live site. Reusable snippets (testimonials, stat blocks). |
| 1.9 | **Snippet picker in templates** | Outreach templates can `{{ insert_case_study slug=ecommerce-rebuild }}` — pulls a channel-appropriate summary into the message. |
| 1.10 | **Source attribution on leads** | Lead.source ties back to monitoring item ID where applicable; report shows leads-per-source over time. |

**V1 explicit non-goals:**
- No outbound publishing (compose externally; use Buffer/Typefully/Postiz for V1)
- No journey/automation builder
- No lead scoring
- No multi-touch attribution
- No campaign aggregator
- No social media analytics
- No email marketing campaigns / newsletters
- No forms (the existing `landing-pages` addon already handles inbound forms; lead inflow via that addon writes directly to V1's leads table)

## V2 — Outbound + reach (after V1 is proven)

**Theme:** *Compose once, post everywhere. Recycle what works.*

Once the inbound loop is stable, add the outbound side. Only worth building when the in-house composer + case-study integration is a meaningful improvement over Buffer/Typefully — typically driven by frustration with the V1-era external tools.

| # | Feature | Notes |
|---|---|---|
| 2.1 | **Composer** | One editor, channel-tagged variants. Channel-aware character limits, formatting (Reddit markdown, LinkedIn line-break style, Twitter thread split). |
| 2.2 | **Channel templates** | `Show HN`, `LinkedIn carousel`, `Twitter thread`, `Reddit case study`, `Dev.to tutorial`. Templates pre-fill structure. |
| 2.3 | **Direct publishing — easy APIs** | Twitter (paid tier), Reddit, Dev.to, Hashnode. Per-channel auth + rate limit handling. |
| 2.4 | **Indirect publishing — copy-and-go** | LinkedIn (personal/company), Hacker News, niche forums: open in tab with content copied to clipboard, tracking record created on confirm. |
| 2.5 | **Scheduling queue** | Pick send time per channel; channel-aware defaults (LinkedIn 08:00 Tue, Reddit 10:00 weekend morning). |
| 2.6 | **Recycle library** | Top-performing posts auto-flagged for re-queue at 90 days with optional rewrite. |
| 2.7 | **Case study insertion** | Composer pulls from V1 case study library: "insert case study" → drops a channel-appropriate summary into the draft. |
| 2.8 | **Engagement back-fill** | For channels with read APIs, pull likes/comments/clicks back onto the post record. Used for recycle scoring and basic analytics. |
| 2.9 | **Idea backlog** | Quick-add post ideas, tagged by channel/topic. Items can be seeded directly from a V1 monitoring inbox item ("this Reddit thread sparked a post idea"). |
| 2.10 | **Calendar view** | What's scheduled across channels this week. Recurring slots ("1 LinkedIn post Mon/Wed/Fri"). |
| 2.11 | **Twitter / X monitoring** | Add Twitter to V1 monitoring list once the user is paying for Twitter API for publishing. |
| 2.12 | **LinkedIn monitoring** | Via 3rd-party service (Taplio / RapidAPI) or browser-extension companion. Postpone to V2 because the API story is messy. |

## V3+ — Reach extensions and depth

**Theme:** *Edge cases, depth, and nice-to-haves.*

Only after V1 + V2 are battle-tested.

| # | Feature | Notes |
|---|---|---|
| 3.1 | **Directory presence tracker** | Clutch / GoodFirms / DesignRush / TheManifest / Awwwards / Dribbble: per-directory record (URL, last refreshed, completeness score, login note). 60-day refresh reminder. |
| 3.2 | **Product Hunt launch checklist** | Stepwise checklist for a launch day, hunter outreach log, asset gallery, post-launch follow-ups. |
| 3.3 | **GitHub profile-as-marketing tracker** | Pinned repos health, README freshness, contribution graph snapshot, stale-repo alerts. |
| 3.4 | **Slack/Discord community log** | Manually-tracked communities, posting cadence, engagement notes. |
| 3.5 | **Lead-gen scraping (optional)** | Apollo / Hunter / Clearbit-style enrichment on lead capture. Skipped unless solo throughput justifies the spend. |
| 3.6 | **Email newsletter** | If/when a list grows past ~500 — until then Buttondown/Substack is fine. |
| 3.7 | **Lead scoring** | Rule-based, simple. Most solo operators don't need this. |
| 3.8 | **Cross-channel attribution** | Time-to-close per source, lead value by channel. Needs V2 publishing data + V1 lead data joined. |
| 3.9 | **Multi-user mode** | If the operator hires a marketing assistant or VA. Adds assignment, notes visibility, role permissions. |
| 3.10 | **AI-assisted composer** | Subject line / hook generation, channel-variant rewrite, send-time prediction. Build only when V2 composer is in heavy use. |

# 6. Refined V1 — concrete scope

## 6.1 Entities (provisional)

All marketing entities live under `domains/marketing/api/src/modules/`. Reads/writes go through services per module-boundaries rules. FK to shared identity (`clients`, `client_contacts`) where leads link to existing clients/contacts.

```
marketing_sources           id, kind ('reddit'|'hackernews'|'rss'), label, config_json, polling_cadence, last_fetched_at
marketing_keywords          id, source_id (FK), phrase, is_active, created_at
marketing_items             id, source_id (FK), keyword_id (FK?), external_id, url, author, title, body_excerpt,
                            posted_at, fetched_at, status ('new'|'engaged'|'dismissed'|'snoozed_until'|'converted_lead'),
                            snoozed_until?, engagement_note?
marketing_leads             id, name, email, channel, source_item_id (FK marketing_items?),
                            service_interest, status ('new'|'contacted'|'qualified'|'proposal'|'won'|'lost'|'dormant'),
                            client_contact_id (FK client_contacts?), client_id (FK clients?), notes, created_at
marketing_lead_events       id, lead_id (FK), kind ('note'|'message_sent'|'reply_received'|'status_change'),
                            body, occurred_at
marketing_followups         id, lead_id (FK), due_at, completed_at?, reason
marketing_templates         id, kind ('cold'|'followup'|'reply'), service_tag, channel, body_with_vars
marketing_case_studies      id, slug, client_label (anonymisable), problem, solution, tech_stack[],
                            outcome, screenshot_urls[], testimonial, live_url, published, created_at
marketing_snippets          id, kind ('testimonial'|'stat'|'short_summary'), body, case_study_id (FK?)
```

**Shared-identity columns to add to existing tables (per `module-boundaries` shared-identity pattern):**

- `client_contacts.marketing_lifecycle_stage` — `'subscriber' | 'lead' | 'mql' | 'opportunity' | 'customer' | 'evangelist'` (enum, nullable)
- `client_contacts.marketing_lead_score` — int (default 0; rule-based, V1 keeps it manual / off)
- `client_contacts.marketing_first_source` — text (e.g., `'reddit:r/webdev'`)
- `client_contacts.marketing_consent_email_at` — timestamptz, nullable

These columns are owned by `domains/marketing/`. Directory's `ClientContactsService` does not read or write them.

## 6.2 Service surface (V1)

- `MonitoringService` — register sources, run polls, ingest items, deduplicate by `external_id`
- `KeywordService` — CRUD for keywords; matches against incoming items
- `InboxService` — list / filter / mark-engaged / dismiss / snooze / convert-to-lead
- `LeadsService` — CRUD leads, status transitions, notes timeline, follow-up scheduling
- `TemplatesService` — CRUD templates, render template with variables (lead name, source URL, case study insertion)
- `CaseStudiesService` — CRUD case studies + snippets, public-facing slug routing into the existing `landing-pages` addon
- `DigestService` — assembles the daily 08:00 email (top items + due follow-ups), enqueues via `notifications` addon

## 6.3 UI surface (V1)

Per frontend conventions: domain ships components only. Pages live in `apps/agency/ui/portals/admin/features/marketing/` (Q1 → A).

Components, in `domains/marketing/ui/`:

- `MonitoringInboxList` — feed view, filter chips, keyboard nav (`j/k`, `e` engaged, `d` dismissed, `s` snooze)
- `MonitoringItemCard` — single item with source badge, keyword highlight, "open original" + action buttons
- `KeywordWatcherEditor` — manage keywords per source
- `LeadList` — table, status filter, search, pagination via URL params (per `data-fetching` rules — server-side only)
- `LeadDetail` — sidebar view: status, notes timeline, follow-ups, "send message via template" action
- `TemplatePicker` — choose template, render preview with current lead's variables filled
- `CaseStudyList` + `CaseStudyEditor` — manage library
- `DigestPreview` — what tomorrow's email will contain (transparency / debug aid)

## 6.4 Integration with existing addons

| Addon / Package | How V1 uses it |
|---|---|
| `notifications` | Sends the 08:00 digest email + ad-hoc follow-up reminders |
| `landing-pages` | Public case study pages (`/case-studies/<slug>`) — V1 may stub this |
| `categories/taxonomy` | Service tags (`web-app`, `saas-mvp`, `react-consulting`) used by templates and case studies |
| `entity-engine` (opt-in) | NOT used in V1 (Q2 → A). All marketing services hand-written. Promote individual entities later only if they reduce to pure CRUD shapes. |
| `packages/platform/queue` | Polling jobs run as queue-backed recurring jobs (Q3 → A). Per-source schedules, retries, DLQ. |
| `oauth` addon | NOT used in V1. V1 source credentials are env vars (Q4 → A). The oauth addon enters in V2 for publishing-as-user flows. |
| Shared identity (`clients`, `client_contacts`) | Lead → contact → client linkage, with prefixed `marketing_*` columns |

## 6.5 Data fetching — non-negotiables

Per `.claude/rules/data-fetching.md`:

- Inbox is server-paginated, server-filtered, server-sorted. No `limit=1000`. No client-side filter derivation.
- "Snoozed until today" is a **server-side filter**, never `.filter(i => i.snoozedUntil < today)` over the full table.
- Lead pipeline counts ("new: 12, contacted: 5") come from `meta.total` on filtered queries, never from a 1000-row fetch.
- Source-attribution reports use a dedicated aggregation endpoint, not a client-side join across `marketing_leads` + `marketing_items`.

# 7. Resolved architectural decisions

All seven V1 architectural questions resolved 2026-04-30. Decisions captured in the frontmatter `decisions:` block; reasoning summarised below for the next reader.

### Q0 — Domain shape (one consolidated marketing, not split into marketing/social/crm)

The two-domain (marketing + social) and three-domain (marketing + social + crm) splits were considered and rejected. Reasoning:

- The natural seam isn't marketing-vs-social — it's **inbound vs outbound**. V1 is all inbound, V2 is all outbound. Splitting marketing/social cuts through the middle of a single user gesture (Reddit thread → lead → outreach template → case study).
- The codebase rule "domains never depend on other domains" forces every cross-domain interaction up to the app layer. For tightly-coupled solo workflows with no second consumer, that's a tax for no benefit yet.
- The lead → monitoring-item link benefits from a real FK; text-only attribution loses information.
- Pre-emptive splits draw lines through unknown territory; the empirical track record of "split first" is poor.

Internal feature folders pre-figure where future splits would land:

```
domains/marketing/
  api/src/modules/
    monitoring/      ← future domains/social/inbound/ if a real second consumer appears
    publishing/      ← future domains/social/outbound/ (V2 only)
    leads/           ← future domains/crm/leads/ when sales-pipeline scope appears
    case-studies/
    templates/
    snippets/
    digest/          ← composes monitoring + leads in-domain (no app-layer file needed)
    follow-ups/
```

### Q1 — App layer → A (feature folder in `apps/agency`)

Pages mounted at `apps/agency/ui/portals/admin/features/marketing/`. No new app, no new portal. Single login, single sidebar; marketing sits next to other admin features.

### Q2 — Service approach → hand-written, NOT entity-engine

All V1 services are hand-written without `entity-engine`. Domain wires platform integrations explicitly via library-style composition:

- Permissions: `RbacIntegrationModule.forFeature({ manifests: [...] })` declared in each module
- Authorisation: `@RequirePermission('marketing.<action>')` decorator on every controller route
- Events: `domainEventEmitter.emit(EVENT_CONST, payload)` from service methods after writes; audit/automations/notifications subscribe automatically
- Polling: `<feature>/jobs/<name>.job.ts` files register processors on `QueueService` and enqueue recurring jobs
- Side-effect reactions: `<feature>/listeners/<name>.listener.ts` files subscribe to events and run pure side-effects
- Cross-domain state mutation that's part of the operation's purpose: subclass composition (the `users-as-library` pattern)

Reference precedent: `packages/platform/settings/api/` — hand-written services, custom controllers, `RbacIntegrationModule.forFeature` for permissions.

UI uses common entity-list primitives where sensible (the data-table / search / filter / pagination components from `@packages/*-ui`). Add/Update forms are hand-coded — templated form generators rarely fit the bespoke validation and layout these flows need.

The reactive/scheduled-work layering (4 tiers: automations / queue jobs / events+listeners / subclass composition) is captured in the frontmatter and applies across all V1 features.

### Q3 — Polling → A (queue-based recurring jobs via `packages/platform/queue`)

Per-source repeat schedules. No in-process `@Cron`. Survives crashes, distributable across instances, retries + DLQ for free. Polling failure has consequences (missed lead-shaped conversations) — queue-based observability matters.

### Q4 — Source credentials → A (env vars)

V1 monitoring is read-only public-data (Reddit / HN / RSS). Doesn't need user-context OAuth. Env vars are the secure default — no DB-backup leakage, no encryption-at-rest work, no admin-UI rendering of secrets. The `oauth` addon enters V2 when publishing-as-user requires per-user OAuth flows.

### Q5 — Form-to-lead REVISED → events+listener (sub-option 5.2: marketing owns form-capture)

The earlier subclass-composition framing was overcorrected and rested on a non-existent landing-pages addon. Corrected pattern:

1. Marketing owns form-capture. New `marketing_form_submissions` table (id, kind, payload jsonb, submitter_email, submitter_name, ip, user_agent, source_url, created_at) plus a public `POST /api/marketing/form-submissions` controller (no auth required, anti-spam via rate-limit + honeypot field).
2. `FormSubmissionsService.create()` writes the submission row and emits `marketing.form_submission.created` with the submission row + key extracted fields in the payload.
3. `domains/marketing/api/leads/listeners/create-lead-from-submission.listener.ts` subscribes to that event, idempotent on `submission_id`, and calls `LeadsService.createFromSubmission()`.
4. Form-submitter sees a "thanks" confirmation immediately. Lead surfaces in the operator inbox seconds later. Eventually-consistent window of seconds is acceptable here — the operator does not watch the inbox in real time.

Why this is not a "events for state mutation" rule violation:

- The submission row is the durable source of truth — captured *before* the listener fires
- The lead is a downstream operator-side projection, not an invariant the form submission must maintain
- Failure modes are bounded: failed listener → DLQ → alert → backfill script reconciles

Open-closed: future reactions (Slack-notify operator, score lead, stamp UTM source on contact) are added as additional listeners on the same event without touching form-submission code.

Mitigations against silent failure:

- Listener is idempotent, keyed on `submission_id`
- Failed listener invocations land in queue DLQ with alerting
- A `marketing:backfill-leads-from-submissions` cron job reconciles any submissions older than N minutes that lack a corresponding lead

When this graduates to a generic `forms` addon (a second domain wants public forms), the listener pattern stays — it just subscribes to `forms.submission.created` instead of `marketing.form_submission.created`.

### Q6 — Digest rendering → A (marketing renders, notifications delivers)

`marketing/digest/DigestService` composes the email HTML/text in-domain. Calls `notifications.send({ to, html, text, subject, kind: 'marketing.digest' })`. Notifications addon stays focused on delivery (provider abstraction, retries, suppression). React-email could be introduced later as a platform capability; not in V1 scope.

### Q7 — Outreach send → A (copy-to-clipboard / open-in-tab)

LinkedIn personal DMs have no API for non-Sales-Navigator accounts (the #1 channel can't be automated). For email, personal-Gmail send beats SaaS-SMTP for B2B deliverability — direct send would actively damage outcomes. Operator review-before-send catches templating errors. Operator confirms with "I sent it" → records `marketing_lead_events.kind = 'message_sent'` and optionally bumps lead status `new → contacted`.

# 8. Success criteria

V1 is "shipped and working" when:

- [ ] User opens the digest email at 08:00 and finds at least 3 actionable items per day, on average, over a 2-week window
- [ ] User has logged at least 5 leads through the inbox-to-CRM path
- [ ] User has created at least 3 case studies in the library and used at least one in an outreach message
- [ ] Time spent on marketing per day, self-reported, drops below 45 minutes
- [ ] Daily digest emails arrive consistently for 14 consecutive days without manual intervention

If any of these don't hit, V2 is paused until V1 is fixed.
