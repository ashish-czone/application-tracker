---
title: Marketing — Spec & Roadmap
status: v1 scoping (created 2026-04-30)
owners: product
target_user: single-owner software-services founder (this codebase's primary operator)
decisions:
  - 2026-04-30 — domain shape is a personal marketing OS, not a multi-tenant marketing automation platform. Solo-operator workflows beat enterprise feature parity.
  - 2026-04-30 — V1 = inbound monitoring + light CRM + case-study library. Outbound publishing automation deferred to V2; existing tools (Buffer/Typefully/Postiz) are good enough until the in-house composer is genuinely better.
  - 2026-04-30 — channels in scope skew B2B-software: LinkedIn, Twitter/X, Reddit, Hacker News, Dev.to, Hashnode, GitHub, Indie Hackers, Product Hunt, agency directories (Clutch / GoodFirms / DesignRush). Instagram, Facebook, TikTok, Shopify Forums explicitly out of scope.
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

Per frontend conventions: domain ships components only. Pages live in the consuming app (likely a new `apps/marketing` or extension of an existing admin app — TBD in §7).

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
| `entity-engine` (opt-in) | Optional — keep services hand-written initially per `domain isolation` principle; revisit if entity-engine pays back |
| Shared identity (`clients`, `client_contacts`) | Lead → contact → client linkage, with prefixed `marketing_*` columns |

## 6.5 Data fetching — non-negotiables

Per `.claude/rules/data-fetching.md`:

- Inbox is server-paginated, server-filtered, server-sorted. No `limit=1000`. No client-side filter derivation.
- "Snoozed until today" is a **server-side filter**, never `.filter(i => i.snoozedUntil < today)` over the full table.
- Lead pipeline counts ("new: 12, contacted: 5") come from `meta.total` on filtered queries, never from a 1000-row fetch.
- Source-attribution reports use a dedicated aggregation endpoint, not a client-side join across `marketing_leads` + `marketing_items`.

# 7. Open questions (must be decided before implementation)

These are the architectural calls per `CLAUDE.md` "Never Make Architectural Decisions Automatically". Each has a recommendation but needs explicit user sign-off.

1. **App layer** — does V1 ship as a feature inside an existing admin app, or as a new `apps/marketing-web`? *Recommendation: feature folder inside an existing admin app, since this is single-operator and doesn't need its own portal yet.*
2. **Hand-written vs. entity-engine services** — keep marketing services hand-written, or use `defineEntity()` for CRUD entities (leads, case studies, templates)? *Recommendation: hand-written V1; the screens are bespoke enough that generic CRUD won't pay back.*
3. **Polling vs. event-driven for monitoring** — use `workflows` addon scheduled cron, or a domain-level scheduler? *Recommendation: workflows addon's scheduled-job primitive — same pattern compliance + recruit already use.*
4. **Reddit API auth** — Reddit's API now requires OAuth app credentials and rate-limits aggressively. Use the `oauth` addon or a marketing-domain-local credential store? *Recommendation: `oauth` addon if it supports Reddit's flow shape; otherwise a per-domain credentials table is acceptable for V1.*
5. **Lead-from-form integration** — when the existing `landing-pages` addon captures a form submission, does it write directly to `marketing_leads`, or emit an event the marketing domain listens to? *Recommendation: event from landing-pages → handler in marketing/leads service that creates the lead. Per event-conventions: this is a side effect of the form submission, exactly the right shape for an event.*
6. **Digest delivery** — does the digest email render server-side via the `notifications` addon's existing template support, or does marketing own the rendering? *Recommendation: marketing owns rendering (digest layout is bespoke); notifications addon handles delivery.*
7. **Where does `outreach template send` actually go?** — for V1, the user copies-to-clipboard or opens-in-tab. We do not actually send LinkedIn DMs from V1. Confirm this is acceptable.

# 8. Success criteria

V1 is "shipped and working" when:

- [ ] User opens the digest email at 08:00 and finds at least 3 actionable items per day, on average, over a 2-week window
- [ ] User has logged at least 5 leads through the inbox-to-CRM path
- [ ] User has created at least 3 case studies in the library and used at least one in an outreach message
- [ ] Time spent on marketing per day, self-reported, drops below 45 minutes
- [ ] Daily digest emails arrive consistently for 14 consecutive days without manual intervention

If any of these don't hit, V2 is paused until V1 is fixed.
