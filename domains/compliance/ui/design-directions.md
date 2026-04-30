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

Sizes (condensed — full scale lives in `packages/core/ui/globals.css` under the `.theme-instrument` block):
- Display: 48 / 40 / 32 px — Instrument Serif, italic variants on secondary headings
- UI: 14 / 13 / 12 px — General Sans, generous `letter-spacing: 0.08em` + uppercase on small-caps labels
- Numerics: 14 / 12 px — JetBrains Mono, `font-feature-settings: "tnum", "zero"`

Ordinal-aware date rendering: `14ᵗʰ April 2026` rendered with a real `<sup>` on the ordinal.

## 5. Color system

Semantic tokens live in `packages/core/ui/globals.css` inside the `.theme-instrument` layer (applied to `<body>` in `apps/compliance-web/index.html`). Values are stored as HSL triples for the `hsl(var(--x))` shadcn pattern.

```
--paper         #F6F3EC   warm parchment, the main bg
--paper-raised  #FBF8F2   cards and surfaces
--paper-sunken  (darker)  inset panels, table headers
--ink           #1A1D21   near-black, warm
--ink-soft      #4A4F57   secondary text
--ink-muted     #8C8576   tertiary, warm gray
--rule          #E1DBCE   hairlines, 1px warm
--rule-strong   (darker)  section rules, emphatic dividers
--authority     #1D3461   deep ink-blue (primary actions, links)
--authority-soft          washed variant for hover/selected
--signal        #C6541D   burnt orange, urgency ONLY
--signal-soft             washed variant for backgrounds
--filed         #3A6F4A   muted forest, success
--filed-soft              washed variant for backgrounds
--due-soon      #B88A2E   warm gold, warning
--due-soon-soft           washed variant for backgrounds
```

The `-soft` / `-sunken` / `-strong` variants are the working surface-tint palette the build actually needs — used for badge fills, hover states, inset rows. They are a practical extension of the core palette above, not a second system.

All primary tokens map onto the existing shadcn semantic slots (`--background` → `--paper`, `--primary` → `--authority`, `--destructive` → `--signal`, etc.) so the rest of the platform stays consistent. Dark mode is spec'd but deferred to a later PR.

The file also ships supporting primitives used by the kit: `@keyframes stamp-in / reveal-up / rule-draw`, the `.small-caps` / `.rule-hair` / `.rule-double` / `.paper-grain` utility classes, `letterSpacing.eyebrow` (`0.14em`) and `letterSpacing.tabular` (`0.02em`), and a sharper `--radius: 0.25rem` override for the Instrument theme.

## 6. Motion & interaction philosophy

- **One orchestrated page-load** per route: staggered reveals on masthead → metrics → main surface, ~300ms total, `cubic-bezier(0.2, 0, 0, 1)`. Not a dozen micro-animations fighting each other.
- **Number transitions** use tabular-safe counters on metric changes.
- **Stamp marks** fade in with a subtle rotate (2°) + scale from 1.1 when a row transitions to FILED.
- **⌘K command palette** is the primary navigation for power users — via `cmdk` (already a shadcn transitive dep).
- **Drawers over modals** for anything with >2 fields. Right-side, full-height, keyboard-closable.
- **No skeleton shimmer soup** — use a single elegant hairline progress bar at the top of the page (NYT-style) for route transitions, and content-shaped skeletons only for large data surfaces.

## 7. Widget inventory

★ = generic, lives in `packages/core/ui/kit/` (imported as `@packages/ui`).
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

### Controls (retuned shadcn primitives — `packages/core/ui/components/`)
The primitives that every form-heavy screen needs. They live alongside the rest of the shadcn primitives in `packages/core/ui/components/` — they are **not** kit-tier widgets and are not exported as `★` decorative pieces. What makes them Instrument is a block of CSS in `packages/core/ui/globals.css` scoped to `.theme-instrument` that reaches into each primitive via `data-slot` hooks and stable ARIA roles. Outside the Instrument theme they fall back to the default shadcn look, so recruit and other apps are unaffected.

18. **`Dialog`** — Paper-raised modal with a serif display title, hairline border (plus a 6px inset hairline frame), sharp 2px corners, warm-ink overlay, and a small-caps close chip. Used for confirmations and focused tasks. Animation stays subdued — no zoom-bounce.
19. **`Sheet`** — Right-side drawer with the same editorial chrome as Dialog. The default for anything with more than two fields.
20. **`Tooltip`** — New primitive (`@radix-ui/react-tooltip`). Ink chip with small-caps all-caps copy, tight tracking, 10px type, no rounded corners. Use for keyboard hints and terse labels — never long sentences.
21. **`Slider`** / **`FormSlider`** — New primitive (`@radix-ui/react-slider`). Hairline track (`--rule`), ink range fill, circular paper-raised thumb with a 1.5px ink rule. Opt-in `ticks` prop draws tick marks on the track; opt-in `legend` renders small-caps labels beneath. `FormSlider` wraps the primitive for react-hook-form with a live tabular-numeric readout.
22. **`Input`** / **`Textarea`** — Paper-raised bed, hairline top/sides, inset bottom-hairline that thickens to 2px of `--authority` on focus. Italic placeholders in `--ink-muted`. `type="number"` / `inputmode="numeric|decimal"` automatically switch to JetBrains Mono with `tnum`/`zero` features.
23. **`FormSelect`** (re-theme only) — The existing popover-combobox trigger inherits the same hairline + inset-rule treatment as `Input`. Popper content (including FormSelect's list, DatePicker, DropdownMenu) picks up paper-raised + hairline border via a popper-wrapper override.
24. **`Checkbox`** — Square (1px radius), `--ink-soft` hairline border on `--paper-raised`. Checked state is a solid ink slab with a paper-colored check glyph — no brand-primary slab.
25. **`RadioGroupItem`** — Same hairline paper circle, checked state draws an 8px ink dot inside.
26. **`DataGrid`** — The full shadcn DataGrid (toolbar, filter builder, bulk bar, pagination, cell renderers) re-themed inside a `data-slot="data-grid"` wrapper: hairline border, paper-sunken thead with small-caps column headers, hairline row rules, paper-sunken row hover, JetBrains Mono on numeric cells via the existing `data-numeric` attribute. This is the grid you use when you need sort / filter / pagination / bulk actions — the kit `DataTable` stays the right pick for dense editorial listings that don't need toolbar machinery.

### Compliance composites
18. **`FilingTaskCard`** ☆ — Card showing one filing: DueDateBlock + client name + law code + rule + handler + status. Has a `markFiled` action that plays the stamp animation.
19. **`FilingTimeline`** ☆ — Horizontal gantt-like timeline of a client's or handler's next 6 months, rendered as ink marks on a ruled baseline. Hover pops a FilingTaskCard.
20. **`ComplianceCalendar`** ☆ — Month-grid calendar, filings laid into days as small typeset blocks (code + count), not circles. Like a newspaper TV listing.
21. **`LawCard`** ☆ — Law display: code (mono), name (serif), jurisdiction tag, issuing authority, effective-from, rule count, handler count.
22. **`ClientLawMatrix`** ☆ — Dense matrix view: clients × laws, each cell shows registration state + next due. The partner-level oversight view.
23. **`HandlerWorkloadBar`** ☆ — Per-handler horizontal load bar, overdue in signal orange, due-this-week in gold, upcoming in ink. Ships alongside **`HandlerWorkloadList`** (same file) — a stacked wrapper that computes a shared scale across N handlers so the bars read comparatively.
24. **`BulkFilingDrawer`** ☆ — Right drawer to mark N filings filed at once; shows each as a mini FilingTaskCard with per-row override fields. Accepts an `inline` prop so the console preview can render it as a static panel instead of a drawer.

## 8. The static demo page — "The Compliance Console"

> **Note:** The `/console-preview` route and its mock-data fixtures were retired once the live screens shipped. The kit widgets and design rationale below remain valid — they are now exercised by the real compliance pages, not by the static demo.

One route, one page, showing every widget with hardcoded mock data. Route: `/console-preview` (hidden from nav; reachable by direct URL during review). The compliance-web `main.tsx` forks on this path and renders the page outside the normal `WebShell` so it owns its full-bleed editorial chrome.

Everything is mock data. Goal: **design review**, not functional review.

**Layout (top to bottom, as shipped):**

1. **Editorial header** — Full-bleed brand masthead with the Compliance Console wordmark, nav, inline command search and user chip. Sits above the `PageMasthead` and replaces the normal app shell for this route.
2. **§ I — Masthead** — `PageMasthead` with "§ I" section mark, serif title "The Compliance Console", subtitle, today as `OrdinalDate`, partner name right-aligned. Hairline rule below.
3. **KPI row** — 4 × `MetricKPI` with embedded `Sparkline`: *Overdue*, *Due This Week*, *Active Clients*, *Filings This Quarter* (each with delta + footnote + staggered reveal).
4. **Calendar + sidebar** — Left column (8 cols): `ComplianceCalendar` for the current fiscal quarter. Right column (4 cols): `StatusDonut` ("Q4 FY 2025-26 filing progress") stacked over `HandlerWorkloadList` (the stacked wrapper, not bare bars).
5. **§ II — The Next Fortnight** — `SectionRule` + full-width `FilingTimeline` across 14 days.
6. **§ III — Filings Desk** — `SectionRule` + `FilterBar` + `DataTable` (~12 rows, `UrgencyBadge` / `OrdinalDate` / `JurisdictionTag` cells, `StampMark`-overlaid FILED rows). Right rail: "Today's Brief" with 3 × `FilingTaskCard` in brief variant.
7. **§ IV — Laws Library** — `SectionRule` + `LawCard` (GST) with a sample `FilingTaskCard` + `HierarchyTreeView` (Laws → Returns → GSTR-1 / GSTR-3B / GSTR-9 …).
8. **§ V — Client × Law Matrix** — `SectionRule` + `ClientLawMatrix` showing registration state and next due.
9. **§ VI — Bulk Filing** — `SectionRule` + `EmptyState` specimen + `BulkFilingDrawer` rendered inline (via the `inline` prop) as a static preview panel.
10. **§ VII — Specimens** — `SectionRule` + `Eyebrow` + typography specimens, all six `UrgencyBadge` states, all `JurisdictionTag` variants, seven `StampMark` kinds (FILED / OVERDUE / DRAFT / VOID / CONFIDENTIAL / REVIEW / …), and four `OrdinalDate` variants. This is the "type & marks" design-review strip.
11. **§ VIII — ⌘K Palette** — `SectionRule` + `CommandPalette` rendered in inline preview mode plus the modal trigger. Groups: Navigate / Create / Actions / Help.
12. **§ IX — Controls Workshop** — `SectionRule` + a three-column working layout that exercises every retuned shadcn primitive against real compliance copy: (a) Overlay surfaces — `Dialog` for a bulk-file confirmation (with an embedded `Checkbox` acknowledgement), `Sheet` for a client profile editor, and three `Tooltip` triggers; (b) Controls — `Slider` with `ticks` + `legend` for grace-period tuning, `RadioGroup` for the 4-tier assignee strategy, `Checkbox` group for notification opts; (c) `Form` specimen — `FormInput`, `FormSelect` (jurisdiction + return type), `FormSlider` (priority weight), `FormTextarea`, `FormCheckbox`, action row. Below the columns, a full-width `DataGrid` ("Ready for filing") with five rows, tabular-numeric amount column, status cells, and the toolbar search bar wired up.
13. **Colophon** — Closing `SectionRule` + small-caps colophon line.

**Kit coverage in the preview:** 16 of 17 ★ widgets are rendered directly, plus all nine retuned controls (Dialog, Sheet, Tooltip, Slider, Input, Textarea, Select, Checkbox, Radio, DataGrid) appear in §IX. `DueDateBlock` is used transitively inside `FilingTaskCard` but is not given its own specimen; `PageProgress` is a route-transition primitive and also has no specimen of its own.

## 9. Dependencies

| Package | Why |
|---|---|
| `framer-motion` | Orchestrated page-load, stamp mark entrance, drawer motion |
| `recharts` | `StatusDonut` and small data viz. (`Sparkline` ended up as hand-rolled SVG, not Recharts — cheaper + no axis cruft to strip.) |
| `cmdk` | `CommandPalette` (already a shadcn transitive dep) |
| `@radix-ui/react-tooltip` | Tooltip primitive |
| `@radix-ui/react-slider` | Slider primitive |

All five ship as deps of `packages/core/ui`. The Dialog/Sheet/Checkbox/Radio/Popover radix packages were already installed.

**Typography** is loaded from CDNs, not npm packages — no `@fontsource/*` deps. `apps/compliance-web/index.html` preconnects to `fonts.googleapis.com` and `api.fontshare.com` and pulls Instrument Serif, JetBrains Mono, Plus Jakarta Sans, and Inter from Google Fonts, plus General Sans from Fontshare. `.theme-instrument` then wires the stacks via `--font-sans` / `--font-serif` / `--font-mono` and turns on OpenType features (`ss01`, `cv11`, `dlig`, `liga`, `tnum`, `zero`). Trade-off: the CDN route avoids a ~1–2 MB bundle hit and is fine for the internal preview surface; when the compliance domain goes to real customer-facing traffic we should revisit `@fontsource/*` for the three critical faces and keep Fontshare for General Sans only.

**Rule-tension note:** `frontend-conventions.md` bars a second **component library** (Chakra, MUI, Mantine). `framer-motion` (motion lib) and `recharts` (viz lib) are not component libraries — they are utility libs composed into our own shadcn-based components. This interpretation was confirmed with the user before proceeding.

## 10. Architectural split

| Where | What |
|---|---|
| `packages/core/ui/kit/` | 17 generic kit widgets (the ★ list). Domain-agnostic — any future domain can reuse them. Imported everywhere as `@packages/ui`. Consistent with the existing precedent that generic cell renderers live in `packages/core/ui`. |
| `packages/core/ui/components/` | Shadcn primitives (Dialog, Sheet, Tooltip, Slider, Form*, DataGrid, etc.) — **not** Instrument-specific. Each opts into the Instrument treatment via a `data-slot` attribute; CSS in `globals.css` does the re-skin. |
| `packages/core/ui/globals.css` (`.theme-instrument` layer) | All Instrument design tokens, keyframes, utility classes, **and** the full control-surface override block that retunes Dialog/Sheet/Input/Textarea/Select/Checkbox/Radio/Tooltip/Slider/DataGrid. No separate `tokens.css` file. |
| `domains/compliance/ui/shared/` | 7 compliance-specific composites (the ☆ list) plus `HandlerWorkloadList`. They know the vocabulary of this domain. |
| `domains/compliance/ui/portals/customer/features/console-preview/` | The static demo page itself + its mock data. Registered as a route in `domains/compliance/ui/index.tsx` and given a full-bleed fork in `apps/compliance-web/src/main.tsx` so it renders outside the `WebShell`. |

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
