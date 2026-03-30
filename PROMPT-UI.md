# Frontend Rules & Conventions

Frontend stack, component rules, form behavior, and UX conventions. Core frontend conventions (architecture, routing, state, color tokens) are also in `.claude/rules/frontend-conventions.md` (auto-loaded). This file provides the detailed reference.

---

## Tech Stack

- React + Vite + React Router + TailwindCSS + shadcn/ui + Lucide icons
- TanStack Table, React Hook Form + Zod, TanStack Query, date-fns
- **No Redux. No Moment.js. No CSS-in-JS. No Next.js. No SSR.**

---

## Frontend Architecture

### Shared package: `packages/ui`

Reusable toolkit — components, hooks, services, types. Nothing imports from `apps/`.

```
packages/ui/
 ├ components/
 │   ├ form/         — FormInput, FormSelect, FormDatePicker, etc.
 │   ├ feedback/     — Toast, Alert
 │   ├ layout/       — Card, Stack
 │   └ data-grid/    — DataGrid, Toolbar, Pagination
 ├ hooks/            — useDebounce, useDataGridParams
 ├ services/         — apiClient, tokenStore
 └ types.ts          — PaginatedResponse, ApiError
```

### Feature UI packages: `packages/*-ui`

Reusable pages, components, hooks for their backend package. Domain-agnostic — work with any entity type.

```
packages/<feature>-ui/
 ├ components/  ├ pages/  ├ hooks/  ├ helpers/  └ index.ts
```

Examples: `entity-engine-ui` (EntityListPage, useEntityLayout), `eav-attributes-ui` (LayoutCanvas, DynamicField)

May import from `packages/ui` and their backend package types. Never from `apps/`.

### App structure: `apps/web/src/`

```
apps/web/src/
 ├ shared/                     — Cross-cutting (auth components, hooks, services)
 ├ portals/
 │   └ customer/               — Single portal
 │       ├ features/           — Feature-based grouping (users/, orders/, etc.)
 │       │   └ <feature>/
 │       │       ├ components/ ├ hooks/ ├ services/ ├ types/ └ pages/
 │       ├ routes.tsx
 │       └ menu.ts
```

### Dependency direction

```
packages/ui  <-  packages/*-ui  <-  shared/  <-  portals/customer/features/
```

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
