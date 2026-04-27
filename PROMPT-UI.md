# Frontend Rules & Conventions

Frontend stack, component rules, form behavior, and UX conventions. Core frontend conventions (architecture, routing, state, color tokens) are also in `.claude/rules/frontend-conventions.md` (auto-loaded). This file provides the detailed reference.

---

## Tech Stack

- React + Vite + React Router + TailwindCSS + shadcn/ui + Lucide icons
- TanStack Table, React Hook Form + Zod, TanStack Query, date-fns
- **No Redux. No Moment.js. No CSS-in-JS. No Next.js. No SSR.**

---

## Frontend Architecture

UI is layered the same way the backend is. Each layer exists because it has a distinct dependency boundary — collapsing layers forces something to live in the wrong place.

### Five layers, top of the stack downward

```
apps/<app>-web/src           composition + screens + routes + portals + cross-domain glue
        ▲ depends on
domains/<x>/ui               entity-bound components, EntityUIConfig registrations, domain hooks
        ▲ depends on
packages/addons/*-ui         opt-in feature plugins (notes, attachments, …) registered via providers
        ▲ depends on
packages/platform/*-ui       generic data widgets (entity-engine pages, generic forms, layout primitives)
        ▲ depends on
packages/core/ui             pure UI primitives — no domain or platform knowledge
```

Each layer ships only the artifacts whose dependencies it can actually own. Drop down to a wrong layer and you create either duplication (in apps) or forced inheritance (in domains).

### What belongs where

| Artifact | Layer | Why |
|---|---|---|
| Pure primitives (Button, Avatar, Modal) | `packages/core/ui` | No business knowledge |
| Generic data widgets (DataGrid, EntityListPage, EntityDetailPage, generic Form-from-schema) | `packages/platform/*-ui` | Entity-engine-aware, but not entity-specific |
| Opt-in feature plugins (NotesTab, AttachmentsPanel) | `packages/addons/*-ui` | Cross-app, registered via provider, opt-in per app |
| EntityUIConfig registrations (presentation, fieldUI, actionUI, detailPlugins) | `domains/<x>/ui/entity-configs/` | One source of truth per entity, domain-wide |
| Entity-bound components (Resume tab on candidate, custom inputs, status badge for one entity) | `domains/<x>/ui/components/<entity>/` | Tied to exactly one entity; reusable across every app that includes the domain |
| Entity-bound data hooks (`useCandidateById`) | `domains/<x>/ui/hooks/` | Same — domain owns the data shape |
| Screens / pages (with layout, tabs, header, navigation) | `apps/<app>-web/src/portals/<portal>/features/` | Routing-aware; each app composes its own |
| Cross-domain widgets (compliance status panel on candidate) | `apps/<app>-web/src/cross-domain/` | Spans domains — only meaningful where multiple domains are composed |
| Routes, navigation, portals, layouts | `apps/<app>-web/src/portals/<portal>/` | App owns its navigation map and audiences |

### Domain UI shape

Domains ship **components**, never **pages**. The hard rule:

```
domains/<x>/ui/
 ├ entity-configs/<entity>.ui.ts      — EntityUIConfig export (presentation, fieldUI, actionUI, detailPlugins, listViews)
 ├ components/<entity>/...            — entity-bound: tab plugins, custom inputs, status badges, formatters
 ├ hooks/                             — entity-aware data hooks (useCandidateById, …)
 ├ services.ts                        — typed wrappers over the entity-engine API
 ├ types/                             — domain types
 └ index.ts                           — exports for apps to consume
```

Forbidden in `domains/<x>/ui`:

- Pages, screens, route tables, portals, layouts, navigation menus
- Calls to `useParams()` or `useNavigate()` (anything route-aware)
- Imports from another domain's UI (cross-domain composition belongs in apps)
- `lib/`, `entities/` folder names (legacy — the canonical names are `services.ts` / `entity-configs/`)

### Why domain components don't get tied to routes

The two principles that keep them route-free:

1. **Identity comes via props, not URL.** A domain component takes its target as a prop:
   - ✅ `<CandidateDetail candidateId={id} onClose={fn} />` — the host (a route, a modal, a slide-over) supplies the id
   - ❌ `<CandidateDetailPage />` reading `useParams()` — that's a page, lives in apps

2. **Components fetch their own data via hooks.** No prop-drilling of data shapes:
   - ✅ `<CandidateDetail candidateId={id} />` internally calls `useCandidateById(id)` (TanStack Query → shared cache, no double-fetch)
   - Apps don't need to know the candidate's columns
   - Pure presentational primitives (badges, formatters) stay prop-driven; entity-aware components are hook-driven

This is what makes the same domain genuinely composable across multiple apps with different navigation, layouts, and audiences.

### App structure

```
apps/<app>-web/src/
 ├ portals/
 │   └ <portal-name>/                 — one folder per audience (recruiter, admin, customer, public, …)
 │       ├ features/                  — one folder per navigation unit (entity feature OR custom screen)
 │       │   └ <feature>/
 │       │       ├ Page.tsx           — the screen (routing-aware)
 │       │       ├ components/        — feature-only components (no cross-feature imports)
 │       │       ├ hooks/             — feature-only hooks
 │       │       └ services.ts        — feature-only API helpers
 │       ├ shared/                    — cross-feature inside this portal
 │       └ routes.tsx                 — portal route table
 ├ cross-domain/                      — widgets/plugins that span domains, registered with the entity-engine provider
 ├ shared/                            — cross-portal app-level (rare)
 ├ globals.css
 └ main.tsx                           — composition root: wires WebShell + domains + addons + plugins
```

### Dependency direction (enforced)

```
packages/core/ui      ←  packages/{platform,addons}/*-ui  ←  domains/<x>/ui  ←  apps/<app>-web/src
```

- `packages/*` cannot import from `domains/*` or `apps/*`.
- `domains/<x>/ui` cannot import from another `domains/<y>/ui` — cross-domain composition belongs in apps.
- `domains/<x>/ui` cannot import from `apps/*`.
- Inside an app: feature folders cannot import from each other. Cross-feature reuse goes through portal-level `shared/` (or, rarely, app-level `shared/`). Never through entity-engine — entity-engine is for cross-entity *data*, not cross-feature *UI sharing*.

---

## 1. Naming & File Conventions

- Components: `PascalCase.tsx` | Hooks: `camelCase.ts` (`use*`) | Utils: `camelCase.ts`
- Types: `PascalCase` | Constants: `UPPER_SNAKE_CASE`
- One component per file.
- **No barrel exports (`index.ts`) in frontend.** Direct imports only.

---

## 2. Component Rules

- Never use native HTML form elements. Use `Form*` wrappers from `@packages/ui/components/form/`.
- All built on shadcn/ui + Radix UI + TailwindCSS.
- Semantic color tokens only (`bg-background`, `text-foreground`).

---

## 3. Forms — React Hook Form + Zod

Zod schema is the single source of truth for frontend validation.

- All strings: `min` + `max` in both Zod and backend DTO.
- Character count: only on textareas and fields with limits under 200 chars.
- Inline validation icons (spinner/check/cross) for uniqueness checks — **onBlur only**.
- Password fields: strength meter + requirements checklist (not a simple checkmark).
- Errors below input on blur. Not on untouched fields. `aria-live` for screen readers.
- Multi-step forms preserve state across steps.

---

## 4. Form Submission

- Disable submit button immediately on click. Re-enable on error.
- Optimistic updates only for invisible-rollback mutations (toggle, reorder, favorite). Never for creates or financial ops.

---

## 5. Tables — TanStack Table

- State synced to URL query params (bookmarkable).
- Default page size: 25. Options: 10, 25, 50, 100.
- Column visibility toggleable, persisted to localStorage.
- Search debounced 300ms.
- Active filters shown as removable chips.
- Responsive: card/list view on mobile.

---

## 6. Routing

- Tabs as nested routes: `/candidates/123/overview`
- Modals use React state, not URL.
- Lazy load at route level with `<Suspense fallback={<PageSkeleton />}>`.

---

## 7. Loading, Empty & Error States

Every data view handles all three:
- **Loading:** Skeleton loaders matching layout shape. Never a centered spinner on blank page.
- **Empty:** Icon + message + CTA button.
- **Error:** Message + retry button.

---

## 8. Error Boundaries

Two levels: per-portal (crash isolation) and app root (last resort). Both show message + reload button.

---

## 9. Authentication & Route Protection

- `useAuth()` via TanStack Query (`queryKey: ["auth", "me"]`, `staleTime: Infinity`).
- `AuthGuard` wraps protected routes, redirects to `/login`.
- Silent refresh via interceptor. Session expiry shows modal (don't redirect immediately — let user copy unsaved work).

---

## 10. RBAC in the UI

`/auth/me` returns permissions. `<Can permission="candidates.delete">` hides (not disables) unauthorized elements.

---

## 11. Global API Error Handling

Interceptor: 401 → refresh, 403 → toast or redirect, 500 → generic toast, network error → offline banner. Features can catch specific errors (409 duplicate) in `onError`.

---

## 12. Toasts & Feedback

All mutations show toast on success/failure. Destructive actions require confirmation dialog with action-specific label and danger variant button.

---

## 13. Data Formatting

All data formatting rules (dates, currency, phone, email, passwords, percentages, timezone) are in `.claude/rules/data-formatting.md` (auto-loaded).

Frontend-specific notes:
- Use `formatDate()`, `formatDateTime()`, `formatRelative()` utilities — never call date-fns directly in components.
- Use `formatCurrency()`, `formatPercentage()` utilities.
- Use `FormPhoneInput` from `@packages/ui/components/form/` for phone input.
- User timezone: `authUser.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone`.

---

## 14. Accessibility

- All interactive elements keyboard navigable.
- Form errors via `aria-live`. Modals trap focus, close on Escape.
- Color never the sole indicator — pair with icon/text.
- Focus rings visible on keyboard, hidden on mouse.

---

## 15. Responsive Design

- Tables → card/list on mobile. Modals → full-screen sheets.
- Sidebar → hamburger on small screens.
- Touch targets: min 44x44px. No horizontal scrolling.

---

## 16. EntityUIConfig — Where Presentation Lives

The api ships zero presentation (see PROMPT-API.md §15). All UI shape for an entity lives on a frontend `EntityUIConfig`, registered with `EntityEngineProvider` and hydrated onto `entity.ui` client-side.

### Shape

```ts
defineEntityUI({
  entityType: 'candidate',
  presentation: {
    icon: 'user-round',         // lucide-react name
    navGroup: 'Talent',         // nav grouping
    navOrder: 10,               // nav sort
    createMode: 'modal',        // 'modal' | 'page'
    afterCreateRoute: '/candidates/:id',
    groupRenderMode: 'tabs',    // 'tabs' | 'list'
    boardFields: ['stage'],     // explicit kanban-grouping fields
  },
  fieldUI: {
    resume: { uiType: 'file' },
    stage: { cellRenderer: 'pipelineStage' },
  },
  actionUI: {
    submitToClient: { label: 'Submit', icon: 'send', variant: 'default' },
  },
  detailPlugins: [/* ... */],
  listViews: [/* ... */],
});
```

### Where it lives

`domains/<x>/ui/entity-configs/<entity>.ui.ts` — one file per entity. Apps that include the domain pick up the config automatically when the domain's `WebManifest` registers it.

### Hydration model

`EntityRegistryEntry` over the wire has no `ui` block. On the frontend, `EntityEngineProvider` runs `hydrateEntities` which composes:

```ts
entity.ui = { ...EntityUIConfig.presentation }
```

Reader code stays idiomatic (`entity.ui?.icon`, `entity.ui?.navGroup`) because hydration restores the same shape — the change is that the presentation source is now the registered UI config, not the api response.

### Field & action UI hydration

`useEntityLayout` and `useListLayout` merge `fieldUI[fieldKey]` and `actionUI[actionKey]` into their results, so per-field and per-action UI surface where rendering happens — the api layout response carries only the schema.

### Workflow → board derivation

Kanban grouping fields are derived client-side, not declared on the api:

```ts
const boardFields = [
  ...new Set([
    ...listLayout.columns.filter((c) => c.fieldType === 'workflow').map((c) => c.fieldKey),
    ...(entity.ui?.boardFields ?? []),
  ]),
];
```

The api decides nothing about kanban — it just exposes the workflow column type via the layout response.

### Boundary enforcement

`eslint.boundaries.config.mjs` blocks `@packages/ui` and `@packages/*-ui` imports from anywhere under `packages/*/*/api/**` and `domains/*/api/**`. CI fails on violation. There is no symmetric ban on ui → api — UI may consume api types via `@packages/entity-engine-contract`.
