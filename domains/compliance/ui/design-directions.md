# Compliance Console — Design Directions

> Detailed design draft for the compliance domain UI. This document is the
> authoritative source of truth for aesthetic decisions, widget inventory,
> and architectural split. Update it as the design evolves.

---

## 1. Market study — what we're borrowing from where

We looked at the products that actually work for compliance professionals (vs. the ones that just ship features):

| Product | What it does well | What we're taking |
|---|---|---|
| **ClearTax / Taxmann** (India tax, closest to our domain) | Filing calendar is *the* core object; return-by-return status tracking; big due-date countdowns | Calendar-first IA; urgency-as-typography not just color |
| **Vanta / Drata** (SOC2 automation) | Framework progress donuts, evidence timelines, control-by-control drill-downs | Completion donut per law/client; evidence trail pattern |
| **Avalara** (sales tax) | Jurisdiction-aware liability views, filing workflows with saved drafts | Jurisdiction as first-class tag; "ready to file" vs "draft" states |
| **Linear / Height** (project mgmt polish) | Keyboard-first, command palette, dense but breathable, tasteful motion | ⌘K everywhere, ~300ms staggered page loads, never a modal if a drawer works |
| **Stripe / Mercury / Ramp** (fintech polish) | Tabular numerics, restrained color, status chips done right | Mono numerics everywhere, semantic color reserved for meaning |
| **The Financial Times / NYT Audm** (editorial) | Hairline rules, marginalia, section numbers, serif display used with confidence | The whole masthead + section rule + roman-numeral section motif |

**What we're rejecting:** the generic SOC2 SaaS aesthetic (Vanta-clone purple-gradient dashboards), OneTrust/MetricStream enterprise ugliness, and the Notion-template "lots of emoji + rounded everything" look. Compliance is a serious craft; the UI should feel like an instrument, not a toy.

## 2. Who this is for

A chartered accountant or tax professional managing 30–300 clients across multiple laws. Daily concerns, in order:
1. **"What's due this week and what's overdue?"** — existential
2. **"For client X, what's coming up and what's filed?"** — client reviews
3. **"Bulk-mark these 12 GSTR-3B filings as filed"** — end-of-month operation
4. **"Which of my handlers is overloaded?"** — partner-level oversight

They want **density**, **keyboard shortcuts**, **tabular numerics**, and **zero ambiguity about status**. They do *not* want onboarding wizards, gamification, cartoony empty states, or "great job 🎉" toasts.

## 3. Aesthetic direction — "The Instrument"

One phrase: **an architect's ledger meets a modern trading terminal.**

Warm paper background instead of cold white. Hairline rules instead of card shadows. Serif display at the top of the page, neo-grotesk for UI chrome, monospace for every number. Deep ink-blue as the authority color. One burnt-orange "signal" accent, used only for urgency — never for decoration. Roman-numeral section markers and ordinal dates (14ᵗʰ April) as quiet hat-tips to the legal/accounting tradition the users come from. A subtle "stamp" motif for state changes (FILED / OVERDUE / DRAFT) that references physical filing but doesn't caricature it.

It should feel like the UI was designed by someone who reads the Financial Times on paper and still uses a fountain pen — but who also writes TypeScript.

The opposite of "AI slop": no purple-pink gradients, no glassmorphism, no rounded-3xl everything, no generic `Inter` + `#6366F1`.

## 4. Typography

| Role | Face | Why |
|---|---|---|
| Display (mastheads, hero numbers) | **Instrument Serif** (Google Fonts, free) | Literary, confident, has real italic character. Uncommon in SaaS. |
| Body / UI | **General Sans** (Fontshare, free) | Neo-grotesk with warmth. A more distinctive alternative to Inter/Söhne. |
| Tabular / Numerics | **JetBrains Mono** (Google Fonts, free) | All numbers, codes, IDs, due-date countdowns. Compliance is numbers. |

Sizes (condensed — full scale lives in `packages/ui/src/kit/tokens.css`):
- Display: 48 / 40 / 32 px — Instrument Serif, italic variants on secondary headings
- UI: 14 / 13 / 12 px — General Sans, generous `letter-spacing: 0.08em` + uppercase on small-caps labels
- Numerics: 14 / 12 px — JetBrains Mono, `font-feature-settings: "tnum", "zero"`

Ordinal-aware date rendering: `14ᵗʰ April 2026` rendered with a real `<sup>` on the ordinal.

## 5. Color system

Semantic tokens (added to the existing theme system — does **not** break `bg-background` conventions):

```
--paper        #F6F3EC   warm parchment, the main bg
--paper-raised #FBF8F2   cards and surfaces
--ink          #1A1D21   near-black, warm
--ink-soft     #4A4F57   secondary text
--ink-muted    #8C8576   tertiary, warm gray
--rule         #E1DBCE   hairlines, 1px warm
--authority    #1D3461   deep ink-blue (primary actions, links)
--signal       #C6541D   burnt orange, urgency ONLY
--filed        #3A6F4A   muted forest, success
--due-soon     #B88A2E   warm gold, warning
```

All mapped to the existing shadcn semantic slots (`--background` → `--paper`, `--primary` → `--authority`, `--destructive` → `--signal`, etc.) so the rest of the platform stays consistent. Dark mode is spec'd but deferred to a later PR.

## 6. Motion & interaction philosophy

- **One orchestrated page-load** per route: staggered reveals on masthead → metrics → main surface, ~300ms total, `cubic-bezier(0.2, 0, 0, 1)`. Not a dozen micro-animations fighting each other.
- **Number transitions** use tabular-safe counters on metric changes.
- **Stamp marks** fade in with a subtle rotate (2°) + scale from 1.1 when a row transitions to FILED.
- **⌘K command palette** is the primary navigation for power users — via `cmdk` (already a shadcn transitive dep).
- **Drawers over modals** for anything with >2 fields. Right-side, full-height, keyboard-closable.
- **No skeleton shimmer soup** — use a single elegant hairline progress bar at the top of the page (NYT-style) for route transitions, and content-shaped skeletons only for large data surfaces.

## 7. Widget inventory

★ = generic, lives in `packages/ui/src/kit/`.
☆ = compliance-specific composite, lives in `domains/compliance/ui/shared/`.

### Typography & chrome
1. **`PageMasthead`** ★ — Newspaper-style page header: small-caps eyebrow + roman-numeral section number + Instrument-Serif title + ordinal date + hairline rule below.
2. **`SectionRule`** ★ — Hairline horizontal divider with optional centered small-caps label ("§ II — Filings").
3. **`Eyebrow`** ★ — Small-caps uppercase label with tracking — used ubiquitously.
4. **`StampMark`** ★ — Decorative angled stamp: `FILED` / `OVERDUE` / `DRAFT` / `VOID`. Subtle rotation, slightly distressed border, sits on top of rows or cards.
5. **`OrdinalDate`** ★ — Renders a date as `14ᵗʰ April 2026` with proper ordinal suffixes.

### Status & data
6. **`UrgencyBadge`** ★ — Six states: `OVERDUE` (signal), `DUE TODAY` (signal outline), `DUE THIS WEEK` (due-soon), `UPCOMING` (ink-soft), `FILED` (filed), `DRAFT` (muted). Small-caps, tracked.
7. **`JurisdictionTag`** ★ — `CENTRAL · STATE · MUNICIPAL · INTERNATIONAL`. Tiny caps, ink-blue rule border.
8. **`StatusDonut`** ★ — Completion donut (filed / pending / overdue / upcoming). Hairline stroke, center shows tabular % in mono. Built on Recharts.
9. **`MetricKPI`** ★ — Big mono number + small-caps label + delta (▲▼) + optional sparkline. The cards that line the top of every page.
10. **`Sparkline`** ★ — 40×16 inline sparkline, hairline stroke. Built on Recharts.
11. **`DueDateBlock`** ★ — Hero display of a deadline: huge ordinal date + day of week + days-until countdown. Used on filing task detail.

### Structure
12. **`DataTable`** ★ — Dense TanStack Table wrapper with tabular numerics, hairline rules, semantic status cells, keyboard row navigation, sticky header, URL-synced sort/filter/page.
13. **`FilterBar`** ★ — Chip-based filter bar with search, saved-view dropdown, clear-all.
14. **`HierarchyTreeView`** ★ — Indented expandable tree with depth-based indents, optional drag-to-reparent. For laws and any other hierarchical entity.
15. **`EmptyState`** ★ — Editorial empty state: a single pulled quote-style message in serif italic, one CTA, nothing else.
16. **`CommandPalette`** ★ — ⌘K palette with sections (Navigate / Create / Action / Help). Already partly in shadcn, needs styling.
17. **`PageProgress`** ★ — 1px top-of-page progress bar for route transitions.

### Compliance composites
18. **`FilingTaskCard`** ☆ — Card showing one filing: DueDateBlock + client name + law code + rule + handler + status. Has a `markFiled` action that plays the stamp animation.
19. **`FilingTimeline`** ☆ — Horizontal gantt-like timeline of a client's or handler's next 6 months, rendered as ink marks on a ruled baseline. Hover pops a FilingTaskCard.
20. **`ComplianceCalendar`** ☆ — Month-grid calendar, filings laid into days as small typeset blocks (code + count), not circles. Like a newspaper TV listing.
21. **`LawCard`** ☆ — Law display: code (mono), name (serif), jurisdiction tag, issuing authority, effective-from, rule count, handler count.
22. **`ClientLawMatrix`** ☆ — Dense matrix view: clients × laws, each cell shows registration state + next due. The partner-level oversight view.
23. **`HandlerWorkloadBar`** ☆ — Per-handler horizontal load bar, overdue in signal orange, due-this-week in gold, upcoming in ink.
24. **`BulkFilingDrawer`** ☆ — Right drawer to mark N filings filed at once; shows each as a mini FilingTaskCard with per-row override fields.

## 8. The static demo page — "Compliance Console"

One route, one page, showing every widget with hardcoded mock data. Route: `/console-preview` (hidden from nav; reachable by direct URL during review).

**Layout (top to bottom):**

1. **Masthead row** — `PageMasthead` with "§ I" eyebrow, "Compliance Console" title, today as ordinal date, "Ashish Goel · Partner" right-aligned. Hairline rule.
2. **KPI row** — 4 × `MetricKPI` cards: *Overdue* (12, ▲3), *Due This Week* (28), *Active Clients* (147), *Filings This Quarter* (412, ▲18%). Each with a sparkline.
3. **Main surface — 2 columns** — Left (8 cols): `ComplianceCalendar`. Right (4 cols): `StatusDonut` + `HandlerWorkloadBar` ×4.
4. **§ II — This Week** — `SectionRule` label + `FilingTimeline` full-width showing 7 days.
5. **§ III — Filings** — `FilterBar` + `DataTable` of sample filings with `UrgencyBadge` / `OrdinalDate` / `JurisdictionTag` and a couple of `StampMark`-overlaid FILED rows.
6. **§ IV — Laws** — `LawCard` (GST) + `HierarchyTreeView` (GST → Returns → GSTR-1, GSTR-3B, GSTR-9…).
7. **§ V — Clients × Laws** — `ClientLawMatrix` (6 clients × 5 laws).
8. **Right rail** — "Today's Brief" with 3 × `FilingTaskCard` + `BulkFilingDrawer` preview.
9. **Masthead footer** — `SectionRule` + small-caps colophon line.
10. **⌘K** opens `CommandPalette` preview.

Everything is mock data. Goal: **design review**, not functional review.

## 9. Dependencies

| Package | Why |
|---|---|
| `framer-motion` | Orchestrated page-load, stamp mark entrance, drawer motion |
| `recharts` | `StatusDonut`, `Sparkline`, small data viz |
| `cmdk` | `CommandPalette` (already a shadcn transitive dep) |
| `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono`, plus a self-hosted General Sans | Typography |

**Rule-tension note:** `frontend-conventions.md` bars a second **component library** (Chakra, MUI, Mantine). `framer-motion` (motion lib) and `recharts` (viz lib) are not component libraries — they are utility libs composed into our own shadcn-based components. This interpretation was confirmed with the user before proceeding.

## 10. Architectural split

| Where | What |
|---|---|
| `packages/ui/src/kit/` | 17 generic widgets (the ★ list). Domain-agnostic — any future domain can reuse them. Consistent with existing precedent that generic cell renderers live in `packages/ui`. |
| `domains/compliance/ui/shared/` | 7 compliance-specific composites (the ☆ list). They know the vocabulary of this domain. |
| `domains/compliance/ui/portals/customer/features/console-preview/` | The static demo page itself + its mock data. Registered as a route in `domains/compliance/ui/index.tsx`. |

**Not** creating a new `packages/compliance-ui` package — `domains/*` is exactly the tier for domain-specific UI per the repo's package-tier rules.

## 11. Out of scope for this pass

- Wiring any component to real API data
- Dark mode
- Mobile layout
- Accessibility audit beyond "keyboard + semantic HTML by default"
- E2E tests for the demo page
- Any backend changes

## 12. Effort estimate

~5–6 days of focused work across multiple commits on `feat/compliance-ui-kit`.
