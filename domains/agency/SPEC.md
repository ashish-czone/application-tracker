---
title: Agency Marketing Site — Spec & Roadmap
status: in progress (updated 2026-04-22)
owners: product + platform
decisions:
  - 2026-04-22 — posts data model: separate entities (Option A). No primitive extraction in v1; revisit if a third entity needs the same fields.
  - 2026-04-22 — blog dropped from v1. Rich-text (F6) + posts (F7) removed from scope; SEO (F8) ships without `/blog` / `/tag` routes. Revisit when the agency actually needs content marketing.
---

# 1. Product vision

A fast, mobile-friendly, visually-bold marketing site for an agency, authored through a WordPress-style backend (pages, menus, media) and rendered by a Next.js public site. Blog is **deferred** — see header decision 2026-04-22.

**Principles**

- **Out-of-the-box beautiful** — no designer required. Pre-configured palettes, modern typography, tasteful motion. Set up in minutes.
- **WordPress-familiar authoring** — author picks a page, reorders sections, swaps block variants, edits section content, changes data source. Menus are trees with 2 levels. Posts are rich-text articles.
- **Platform-consistent** — reuse `@packages/pages`, `@packages/menus`, `@packages/blocks-ui`, `@packages/theming-ui`, `defineEntity()`, the block registry. No forks; extend through hooks and new blocks.
- **Mobile-first** — designed from 360px up. 44px tap targets, no horizontal scroll, drawer nav.
- **Design-forward** — borrow cues from Work & Co, Instrument, Ueno, AKQA, Huge, Ragged Edge, Wolff Olins. Bold type, editorial grids, subtle motion, sticky headers, decisive use of space.

# 2. Scope

## 2.1 In scope (v1)

- Public site routes: `/`, `/<slug>`, `/404`
- Admin screens: Pages (exists), Menus (exists), Media Library ✅ (shipped), Site Settings ✅ (shipped), Theme / Appearance (upgrade existing — F2 pending)
- ~10 high-quality block types with 2–3 variants each
- 4–6 pre-configured theme palettes with a light/dark toggle on the public site
- SEO: per-page meta, OG image, dynamic sitemap, robots.txt, JSON-LD for Organization + WebPage
- Motion: Framer Motion for scroll-reveal, hover lifts, menu transitions (subtle only)

## 2.2 Out of scope (v1)

- **Blog** (posts, rich text, `/blog`, `/tag` routes, Article JSON-LD) — dropped 2026-04-22; revisit later.
- Multi-tenant / multi-site (agency-site is single-tenant for now — flagged in follow-ups)
- Page scheduling beyond a single `publishedAt`
- Comments, forms-builder, newsletter sign-up (CTA links only)
- A/B testing or personalisation
- Per-section dark-mode toggle (theme toggle is site-wide)

# 3. UX overview

## 3.1 Public site (`apps/agency/ui/portals/customer`, Next.js 15, port 3100)

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]      Services   Work   About   Blog   [Contact] │  ← sticky, shrinks on scroll
├─────────────────────────────────────────────────────────┤
│                                                         │
│        HERO — fluid headline, 2-line sub, CTA pair      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│   Stats row · Client logos marquee · Services grid      │
│   Testimonials · Team grid · Process timeline · CTA     │
├─────────────────────────────────────────────────────────┤
│  Footer — brand, secondary menu, social, newsletter CTA │
└─────────────────────────────────────────────────────────┘
```

- Header: transparent over hero, solid-with-blur on scroll. Mobile: hamburger → full-height drawer with accordion submenus.
- Sections: full-bleed by default, max-width content, generous vertical rhythm (`py-20 md:py-32`).
- Motion: `whileInView` fade-up on sections (200ms, 40px), hover-lift on cards, smooth drawer slide. All motion respects `prefers-reduced-motion`.
- Blog: card grid, featured post hero, tag chips. Post detail: editorial layout — wide hero image, narrow reading column (`max-w-prose`), author card, related posts.

## 3.2 Admin (`apps/agency/ui/portals/admin`)

| Route                    | Purpose                                                                                       | Status         |
| ------------------------ | --------------------------------------------------------------------------------------------- | -------------- |
| `/pages`                 | List / create / edit pages; Puck editor for sections; publish + SEO panels.                   | ✅ shipped (F0) |
| `/menus`                 | List / edit menus; tree editor with drag reorder, indent/outdent.                             | ✅ exists       |
| `/media-library`         | Gallery, drag-drop upload, per-file progress, alt/caption edit, delete; `media` field type.   | ✅ shipped (F5) |
| `/app-settings` (site)   | Logo, tagline, contact, social, default OG image, analytics. Rendered from `site` module.     | ✅ shipped (F1) |
| `/appearance`            | Pick palette, typography scale, radius, header style. Live preview, persisted to site.        | ⚠️ F2 pending — global admin state only, not site-persistent |

## 3.3 Section editor (Puck) — required behaviours

Today, Puck already supports reorder / add / delete / variant-pick for blocks registered via `blockRegistry`. What still needs wiring (from follow-ups in PR #917/#919 and this spec):

- [x] Image field backed by the media library picker — the `media` field type shipped in PR #981 supplies the picker; block fields can declare `fieldType: 'media'`.
- [x] Data-source picker (`DataSourcePicker.tsx`) integrated (PR #947 resolves section data sources in the public-page API).
- [ ] Diff-based save (currently replace-all — fine for v1 but flagged).
- ~~Rich-text field (TipTap) wired into Puck~~ — deferred with the blog (see header decision).

# 4. Data model

## 4.1 Decision — separate entities (Option A)

> Decided 2026-04-22: pages and posts stay as separate entities. No extraction of `publishable` / `seo` / `sluggable` into shared platform primitives in v1 — some duplication is acceptable. Revisit if/when a third entity needs the same fields, at which point we refactor to shared primitives. With posts dropped from v1 scope (2026-04-22), this decision only governs the `pages` shape for now; the implications below are forward-looking.

**Implications for the work below:**
- Fields like `publishedAt`, `status`, SEO meta live on `pages` today. If/when `posts` reappears, they will be duplicated, not shared.
- Each entity owns its own publishable-filter helpers (public endpoints hide drafts) — copied, not shared.
- If a third consumer of these fields appears later (e.g. case studies, landing variants), that is the moment to stop and extract primitives.

## 4.2 Entities

### `pages` (existing — publish fields shipped in F0)
```
+ publishedAt timestamptz?                                       -- ✅ shipped (#959)
+ status      enum(draft, scheduled, published, archived)        -- ✅ shipped
+ seo         jsonb                                              -- ✅ shipped (backfill from old columns kept for one release)
```

### `site_settings` — shipped as `site` settings module (F1 #975)
Implemented via the platform settings engine (`AppConfigService.register('site', …)`) rather than a dedicated entity. 18 keys: `companyName, companyLogo, siteName, tagline, description, contactEmail, contactPhone, address, social.{twitter, linkedin, instagram, github, youtube}, defaultSeo.{title, description, ogImage}, analytics.{ga4, posthog}`. `PUBLIC_SITE_KEYS` allow-list guards the `/public/site-settings` endpoint. `theme` jsonb is NOT yet present — to be added by F2.

### `media_assets` — shipped in F5 (#979, #981)
```
id            uuid PK
storageKey    text unique           -- path on the storage backend
url           text                  -- resolved public URL
originalName  text
mimeType      text
size          int
width         int?
height        int?
altText       text?
caption       text?
createdBy     uuid FK users
createdAt     timestamptz
updatedAt     timestamptz
deletedAt     timestamptz?
```
Composite upload endpoint `POST /media-assets/upload` writes the file + creates the row in one round-trip. The `media` field type (reference family, UUID in `valueText`) lets any entity reference an asset.

### `posts` — **deferred (blog dropped from v1 — 2026-04-22)**

Previous schema sketch preserved for the eventual revival:
```
id          uuid PK
title       text
slug        text unique
excerpt     text
body        jsonb          -- TipTap doc
coverImage  uuid FK media  -- via media field type once revived
authorId    uuid FK users
publishedAt timestamptz?
status      enum(draft, scheduled, published, archived)
seo         jsonb          -- {title, description, ogImage, canonicalUrl}
tags        category[]
readingTime int generated
createdAt   timestamptz
updatedAt   timestamptz
deletedAt   timestamptz?
```

## 4.3 Block registry

Existing content blocks (testimonials, team-grid, services-grid, value-props-grid, stats-row, faq-accordion, client-logos-row) stay. Starter blocks (Hero, Text, Image, FeatureList, CTA) stay; Hero + CTA shipped with 2–3 variants in F4 (#963).

Blog-specific blocks (`blog-featured`, `blog-list`, `blog-cta`, `post-body`) are **deferred with the blog**.

# 5. Current state (2026-04-22)

## 5.1 Shipped

| Area                           | Artifact                                                                                           | Notes                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Pages backend                  | `@packages/pages-api` (entities `pages` + `sections`)                                              | PR #917                                    |
| Pages admin (Puck)             | `@packages/pages-ui-admin`                                                                         | PR #919                                    |
| Public page renderer           | `apps/agency/ui/portals/customer/src/app/[slug]/page.tsx`                                          | ISR 60s + `/api/revalidate` webhook        |
| Block contract + registry      | `packages/platform/blocks/{contract,ui}`                                                           | `defineBlock`, `blockRegistry`             |
| Starter blocks                 | Hero, Text, Image, FeatureList, CTA                                                                | **Hero + CTA redesigned with 3 variants each in F4** |
| Content blocks (7)             | testimonials-grid, faq-accordion, team-grid, services-grid, client-logos-row, value-props-grid, stats-row | Testimonials/Stats/Logos redesigned in F4  |
| Data-source picker integration | `DataSourcePicker` + resolution in public-page API                                                 | PR #947                                    |
| Menus backend + admin + renderer | `@packages/menus-*`                                                                              | PR #939                                    |
| Orderable primitive            | `@packages/orderable`                                                                              | PR #936                                    |
| **F0** Publish + SEO on pages  | `publishedAt`, `status`, `seo` jsonb on pages; public endpoint filters drafts; admin publish panel | PR #959                                    |
| **F1** Site settings           | `site` settings module (18 keys), `GET /public/site-settings`, portal wiring (layout, header, footer, org JSON-LD) | PR #975                                    |
| **F3** Public design system    | Framer Motion + reduced-motion helper, fluid type + variable fonts, sticky blurred header with mobile drawer, dark inverse footer, motion primitives, 404 redesign | PR #961                                    |
| **F4** Block design pass       | Hero (3 variants), CTA (3 variants), Testimonials (card+quote), Stats (editorial numerals), Logos (CSS marquee) | PR #963 — remaining F4.3 blocks pending    |
| **F5** Media library           | `@packages/media-library-api` (MediaAsset entity, composite upload, sharp dimensions) + `@packages/media-library-ui-admin` (gallery page, drag-drop upload, per-file progress, detail drawer) + `media` field type (picker dialog, view, cell) | PRs #979, #981                             |
| **F8** SEO + discoverability   | Public pages-index endpoint, dynamic sitemap from published pages, `robots.txt`, JSON-LD for Organization + WebPage | PR #964                                    |
| Agency domain module           | `domains/agency/api/` (imports pages + menus + content + media-library, demo seed)                 |                                            |
| Demo content                   | `domains/agency/api/seeds/demo-content.ts` (testimonials, team, services, …)                       | Good showcase data                         |

## 5.2 Partial / weak

- **Theme persistence (F2)** — `@packages/theming-ui` is global admin state only; public site still reads tokens from design-system CSS (F3 shipped the tokens but not per-site persistence). No admin → public propagation, no light/dark toggle in the public header.
- **F4.3 remaining blocks** — Team, Services, FAQ, Value-props still on pre-design-pass visuals. Design tokens are available; it's a pure design pass.
- **Site logo / OG image are plain URL fields** — F1 shipped string fields for `companyLogo` and `defaultSeo.ogImage`. Ideal follow-up is a retrofit to the `media` field type so admins pick from the library instead of pasting URLs.

## 5.3 Missing

- **F2 theme persistence** — end-to-end palette picker → site_settings.theme → public CSS variables → light/dark toggle in header.
- **F4.4 new blocks** — process timeline, case-study grid, pricing, contact form placeholder.
- **F9 polish / a11y / perf sweep** — mobile sweep at 360/768/1024/1440, Lighthouse target ≥ 95, conditional analytics snippet, a11y audit.
- **F10 supervisor audit** — final naming/boundary/test/docs pass.
- ~~Rich-text editor (F6)~~ — deferred with the blog.
- ~~Posts / blog (F7) + `/tag/<slug>`~~ — deferred.

# 6. Tasks — grouped by feature

Tasks follow the workflow in `CLAUDE.md` (one commit per task, one PR per feature, separate worktree per feature). Each feature → one PR unless noted. Features are ordered by dependency, but several can run in parallel once prerequisites are shipped.

## F0. Prerequisites — publishing on pages ✅ (PR #959)

- [x] **F0.1 — Decide posts data model.** Resolved 2026-04-22: separate entities, no shared primitives (§4.1).
- [x] **F0.2 — Add publish fields to `pages`.** `publishedAt` + `status` enum, existing rows defaulted to `published`.
- [x] **F0.3 — Add `seo` jsonb to `pages`.** Backfilled from legacy `metaDescription` + `ogImage`.
- [x] **F0.4 — Public endpoint filters drafts.** `GET /public/pages/:slug` returns 404 for unpublished or future `publishedAt`.
- [x] **F0.5 — Admin publish panel.** Status toggle + publishedAt picker in page editor.

## F1. Site settings + branding ✅ (PR #975)

- [x] **F1.1 — Schema.** Shipped as a `site` settings module (`AppConfigService.register`) — 18 keys grouped into branding, contact, social, default SEO, analytics. Singleton by construction (settings engine is key-value, one row per key).
- [x] **F1.2 — Service + API.** `GET /public/site-settings` with `PUBLIC_SITE_KEYS` allow-list (anonymous); admin CRUD via generic settings engine (`/app-settings`).
- [x] **F1.3 — Admin UI.** Rendered by `@packages/settings-ui` at `/app-settings` — no custom page needed.
- [x] **F1.4 — Hook up customer portal.** `fetchSiteSettings()` with ISR cache; `SiteHeader`, `SiteFooter`, `layout.tsx` metadata, Organization JSON-LD all consume real values.

**F1 follow-up (not blocking V1, tracked here):** retrofit `companyLogo` + `defaultSeo.ogImage` from plain URL strings to the `media` field type now that F5 has shipped — admins currently paste URLs; they should pick from the library.

## F2. Theme-editor persistence + public propagation — pending

- [ ] **F2.1 — Extend theming-ui presets** — add 4–6 curated palettes aligned to agency aesthetics (Minimal, Bold, Editorial, Studio Dark, Warm, Monochrome). Typography scales (compact / standard / editorial).
- [ ] **F2.2 — Persist theme in site settings.** Admin `AppearancePage` writes a `theme` key into the `site` settings module (schema addition). Live preview in admin.
- [ ] **F2.3 — Public site theme loader.** `apps/agency/ui/portals/customer` reads theme via the existing `fetchSiteSettings()` call in `layout.tsx`, emits CSS variables inline in `<head>` to avoid FOUC. Respects user's `prefers-color-scheme` for mode auto.
- [ ] **F2.4 — Light/dark toggle in header** (persists to localStorage; defaults to system).

## F3. Public site design system + layout ✅ (PR #961)

- [x] **F3.1 — Install Framer Motion** in customer portal + `prefers-reduced-motion` helper.
- [x] **F3.2 — Typography system.** Variable fonts + fluid `clamp()` scale + semantic classes shipped as `df214d4f`.
- [x] **F3.3 — Header redesign.** Sticky, transparent → blurred on scroll, mobile drawer with accordion submenus (`5638c08b`).
- [x] **F3.4 — Footer component.** Dark inverse footer with optional footer menu (`94802e8e`).
- [x] **F3.5 — Page wrapper + motion primitives.** `<Section>`, `<Reveal>`, `<HoverLift>` (`5f82cb12`).
- [x] **F3.6 — 404 polish.** Rebuilt to match the design system (`25c5fae6`).

## F4. Block upgrades (design pass)

- [x] **F4.1 — Hero variants.** Centered (default), split, full-bleed. Eyebrow + secondary CTA added. Fluid type + pill CTAs. (PR #963)
- [x] **F4.2 — CTA variants.** Centered, banner (inverse full-bleed), split. (PR #963)
- [ ] **F4.3 — Existing content blocks design pass.** Shipped so far: Testimonials (card + serif quote + hairline divider), Stats (editorial numerals, auto-adjust column count), Logos (CSS-only marquee with edge mask, grid fallback). **Pending:** Team (card hover reveal), Services (icon grid + alternating rows), Value-props, FAQ.
- [ ] **F4.4 — New blocks.** Process timeline, case-study grid, pricing, contact form placeholder.

## F5. Media library ✅ (PRs #979, #981)

- [x] **F5a.1 — Package skeleton.** `@packages/media-library-api` + `ui/admin` scaffold.
- [x] **F5a.2 — MediaAsset entity.** `media_assets` table via `defineEntity()` with system/readonly metadata fields; altText + caption are the only user-editable fields post-upload.
- [x] **F5a.3 — Composite upload endpoint.** `POST /media-assets/upload` with multipart, `sharp` dimension extraction, orphan-file cleanup on DB failure.
- [x] **F5b.1 — Admin library page.** `/media-library` — gallery grid, drag-drop upload tile (page-wide overlay), per-file progress strip, detail drawer for preview + metadata + alt/caption edit + delete with confirm.
- [x] **F5b.2 — `media` field type.** Registered via `mediaLibraryFieldTypesPlugin` (reference family, UUID in `valueText`). UI: `MediaPickerForm` (thumbnail + picker dialog with gallery + inline upload), `MediaView` for read-only, `mediaCell` for data grids.

## F6. Rich-text editor (TipTap) — deferred with the blog

~~Tracking kept for revival if a non-blog consumer (e.g. long-form site page) needs it.~~

## F7. Posts / blog — deferred (out of v1)

~~Blog dropped 2026-04-22. Schema sketch preserved in §4.2 for the eventual revival.~~

## F8. SEO + discoverability ✅ (PR #964)

- [x] **F8.1 — Public pages-index endpoint.** `GET /public/pages` returns slug + updatedAt (`41af23d5`).
- [x] **F8.2 — Dynamic sitemap.** `apps/agency/ui/portals/customer/src/app/sitemap.ts` pulls published pages (`7cfa116d`). Post + tag routes dropped with the blog.
- [x] **F8.3 — `robots.txt`** (`254120ea`).
- [x] **F8.4 — JSON-LD.** Organization (site-wide, wired to F1 site settings) + WebPage (`8261b599`). Article + BreadcrumbList scoped out with the blog.
- [x] **F8.5 — OG image defaults + per-page override.** Falls back to `site.defaultSeo.ogImage`; page `seo.ogImage` overrides.

## F9. Polish, accessibility, perf — pending

- [ ] **F9.1 — Mobile sweep.** Every page at 360/768/1024/1440. No horizontal scroll. Drawer, accordions, stacking.
- [ ] **F9.2 — a11y audit.** Keyboard nav, focus states, ARIA on menu drawer, colour contrast on each palette, skip-to-content link, reduced motion.
- [ ] **F9.3 — Perf.** `next/image` on all block images, font preload, critical-CSS inline theme vars, Lighthouse ≥ 95 mobile/desktop.
- [ ] **F9.4 — Analytics snippet** — conditional on `site.analytics.ga4` / `site.analytics.posthog`.

## F10. Supervisor audit (per CLAUDE.md Step 3) — pending

- [ ] **F10.1 — Naming + boundary audit** — no addon→addon imports, no package→domain references, no frontend→backend imports.
- [ ] **F10.2 — Test coverage audit** — every new endpoint has 401 + 403 security tests; every new block has a renderer test.
- [ ] **F10.3 — Docs** — update `packages/*/README.md` where present; fold follow-ups from PR #917/#919 that this roadmap covered into closed items.

# 7. Dependencies / critical path

```
F0 ✅ ──► F1 ✅ ──► F2 (theme persistence)
     │
     └─► F3 ✅ ──► F4 (block design pass — partial)
                │
                └─► F8 ✅ (SEO)
F5 ✅ (media) ──► [F6 deferred] ──► [F7 deferred]
```

Remaining path to demoable v1: **F2 → F4.3 tail + F4.4 → F9 → F10**. F1 logo/OG-image retrofit to the media field type is a small follow-up that bundles naturally with F2 or F9.

# 8. Success criteria

- A fresh-install agency app can be branded (logo, palette, contact) in < 5 minutes.
- A non-technical author can create a page from 6+ section blocks, reorder/delete, pick block variants, change data source, publish, and see it live within 60s.
- Public Lighthouse ≥ 95 on mobile and desktop (perf, a11y, SEO, best practices) on home + top marketing pages.
- Site is visibly competitive with mid-tier UK/US agency sites on first load.
- ~~Blog drafting / publish / `/tag` criteria~~ — deferred with the blog.

# 9. Open questions

1. ~~**Data model.**~~ Resolved — separate entities (§4.1).
2. **Multi-site / multi-tenant** — is each agency-app deployment single-site forever, or will we need subdomain routing later? Impacts whether `site` settings stays a single module or needs per-tenant scoping.
3. ~~**Rich-text engine.**~~ Deferred with the blog.
4. **Theme scope** — do we want per-page theme overrides (e.g. a dark landing page on a light site), or site-wide only in v1? Spec currently assumes site-wide only.
5. **Newsletter / forms** — v1 links out only. When forms-builder arrives, is it an addon or part of site settings?
6. ~~**Comments on posts** — out of v1.~~ Moot with the blog deferred.
