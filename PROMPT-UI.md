# Frontend Rules & Conventions

This document defines the frontend stack, component rules, form behavior, data formatting, and UX conventions. Follow every instruction exactly.

---

## Tech Stack

- **Framework:** React + Vite + React Router
- **Styling:** TailwindCSS (use semantic color tokens — `bg-background`, `text-foreground` — never hardcode colors like `bg-white`)
- **Component library:** shadcn/ui
- **Icons:** Lucide (shadcn/ui default)
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod
- **Server state:** TanStack Query
- **UI state:** React local state (useState/useReducer)
- **Date handling:** date-fns
- **No Redux. No Moment.js. No CSS-in-JS. No Next.js. No SSR.**

---

## Frontend Architecture

The backend API follows a strict modular/domain-separated architecture. **The frontend does not.** The frontend is organized by **layers**: a shared UI package, a shared app layer for cross-cutting concerns, and a single portal with feature-based grouping.

### Shared package: `packages/ui`

`packages/ui` is the shared frontend toolkit — reusable across any app in the monorepo. It contains components, hooks, services, and types. **Nothing in this package may import from `apps/`.**

```
packages/ui/
 ├ components/
 │   ├ form/                — Form wrappers (Input, Select, Checkbox, DatePicker)
 │   ├ feedback/            — User feedback (Toast, Alert)
 │   ├ layout/              — Layout primitives (Card, Stack)
 │   ├ data-grid/           — DataGrid, DataGridToolbar, DataGridPagination, etc.
 │   └ Button.tsx           — Ungrouped components at root
 ├ hooks/                   — Generic utility hooks (useDebounce, useDataGridParams)
 ├ services/                — HTTP infrastructure (apiClient, tokenStore)
 ├ types.ts                 — Generic utility types (PaginatedResponse, ApiError)
 └ index.ts
```

**Component grouping rules:**
- Group related components into subfolders (`form/`, `feedback/`, `layout/`, `data-grid/`).
- Components that don't fit a group sit at the `components/` root.
- All components are built on shadcn/ui primitives + Radix UI + TailwindCSS.

**What belongs in `packages/ui`:**
- Pure, reusable UI components with no business logic
- Generic utility hooks (no domain knowledge)
- HTTP client infrastructure (apiClient, token management, interceptors)
- Generic TypeScript types used across the app

**What does NOT belong in `packages/ui`:**
- Domain-specific components, hooks, types, or services
- Auth forms, business validation schemas, domain API calls
- Anything that references a specific entity (User, Order, Role, etc.)

### Feature UI packages: `packages/*-ui`

Feature UI packages provide reusable pages, components, hooks, and helpers for their corresponding backend package. They sit between `packages/ui` (fully generic) and app-level code (domain-specific).

```
packages/<feature>-ui/
 ├ components/         — Reusable React components for the feature
 ├ pages/              — Full page components (list, detail, create, etc.)
 ├ hooks/              — React hooks (data fetching, state management)
 ├ helpers/            — Pure utility functions (schema builders, formatters)
 └ index.ts            — Public API surface
```

**Examples:**
- `packages/entity-engine-ui` — `EntityListPage`, `EntityDetailPage`, `useEntityLayout`, `useListLayout`, `createEntityHooks()`
- `packages/eav-attributes-ui` — `LayoutCanvas`, `DynamicField`, `buildFormSchema()`

**Rules:**
- **Domain-agnostic.** They work with any entity type, not a specific business entity. `EntityListPage` renders a list for *any* entity — it never references "candidates" or "orders".
- **May import from `packages/ui`** for base components and hooks.
- **May import from their backend package** for types only (e.g., `FieldType` from `@packages/eav-attributes`).
- **Never import from `apps/`.** They receive app-specific config via props or context.
- **May contain hooks.** Data-fetching hooks (`useEntityLayout`) and state management hooks are allowed — they are still reusable across apps.
- **May contain pages.** Full page components that apps wire into their router.

**Dependency direction:**
```
packages/ui  ←  packages/*-ui  ←  apps/*/src/
```

### App structure: `apps/web/src/`

```
apps/web/src/
 ├ shared/                     — Cross-cutting concerns (full stack: components, hooks, services)
 │   └ auth/
 │       ├ components/         — AuthGuard, LoginForm, SessionExpiredModal
 │       ├ hooks/              — useAuth, useCurrentUser, useLogin, useCan
 │       └ services/           — Auth API calls, token management
 │
 ├ portals/
 │   └ customer/               — Single portal (no multi-portal split)
 │       ├ features/
 │       │   └ users/          — Feature-based grouping
 │       │       ├ components/ — UsersTable, UserFilters
 │       │       ├ hooks/      — useUsers
 │       │       ├ services/   — User API calls
 │       │       ├ types/      — User, ListUsersParams
 │       │       └ pages/      — UsersListPage
 │       ├ routes.tsx          — Lazy-loaded route exports
 │       └ menu.ts             — Sidebar navigation config
```

### Layers

| Layer | Scope | Business logic? | Example |
|---|---|---|---|
| `packages/ui` | Global (shared package) | No | Button, DataGrid, useDebounce, apiClient |
| `packages/*-ui` | Feature (shared package) | No | EntityListPage, DynamicField, useEntityLayout |
| `shared/` | Cross-cutting (app-level) | Yes | auth (components, hooks, services, token management) |
| `portals/customer/features/` | Feature-specific | Yes | users (pages, components, hooks, services, types) |

### Dependency rules

```
packages/ui  ←  packages/*-ui  ←  shared/  ←  portals/customer/features/
```

- **Portal features** can import from `packages/ui`, `packages/*-ui`, and `shared/`.
- **`shared/`** can import from `packages/ui` and `packages/*-ui`.
- **`packages/*-ui`** can import from `packages/ui` and their corresponding backend package types.
- **`packages/ui`** imports nothing from the app or other packages.

### Shared rules (`shared/`)

- `shared/` holds **cross-cutting concerns** — logic that is not specific to any one feature and would be needed across multiple features or a future second portal.
- Each concern is a **full-stack folder** with its own components, hooks, services, and types. Not limited to presentational/dumb components.
- Examples: `auth` (login, session, tokens, permissions), `notifications` (toasts, in-app notifications), `error-handling` (error boundaries, global error state).
- Do not add a concern to `shared/` if it is only used by one feature. Keep it in the feature until a second consumer needs it.

### Portal rules

- There is a **single portal** (`customer`). No multi-portal architecture.
- The portal uses **feature-based grouping** — each domain feature (users, orders, etc.) gets its own folder under `features/` with pages, components, hooks, services, and types.
- The portal has a `routes.tsx` (lazy-loaded page exports) and `menu.ts` (sidebar navigation config).
- Domain types (e.g., `User`, `ListUsersParams`) live in the feature that owns them (`features/users/types/`), not at a shared level.

---

## 1. Naming & File Conventions

- **Components:** `PascalCase.tsx` (`CandidateTable.tsx`)
- **Hooks:** `camelCase.ts` starting with `use` (`useCandidates.ts`)
- **Utils:** `camelCase.ts` (`formatDate.ts`)
- **Types/Interfaces:** `PascalCase` (`CandidateFormValues`)
- **Constants:** `UPPER_SNAKE_CASE` (`DEFAULT_PAGE_SIZE`)
- **One component per file.** No co-located secondary components.
- **No barrel exports (`index.ts`).** Use direct imports to avoid circular dependency issues and slow builds.

---

## 2. Component Rules

### Always use shared wrappers

Never use native HTML form elements (`<input>`, `<select>`, `<textarea>`) directly. Always use the shared wrapper components from `@packages/ui/components/form/`. These wrappers integrate:

- React Hook Form's `Controller`
- Error message display
- Character count (where applicable)
- Consistent styling across browsers
- Accessibility attributes (`aria-invalid`, `aria-describedby`)

Example shared components: `FormInput`, `FormTextarea`, `FormSelect`, `FormDatePicker`, `FormCheckbox`.

### shadcn/ui as the base

All shared UI components in `@packages/ui` are built on top of shadcn/ui primitives. Do not install a second component library. If shadcn/ui doesn't have a component, build it using Radix UI primitives (which shadcn/ui is based on) and TailwindCSS.

### Semantic color tokens

Always use semantic tokens (`bg-background`, `text-foreground`, `border-border`) instead of hardcoded colors (`bg-white`, `text-gray-900`). This keeps the door open for dark mode without touching any component code.

---

## 3. Forms — React Hook Form + Zod

### Zod is the single source of truth

The Zod schema defines all frontend validation rules. Never duplicate validation logic outside the schema. Note: the backend uses `class-validator` (not Zod), so frontend and backend validations are defined separately but must enforce the same constraints (field lengths, formats, required fields).

```ts
const candidateSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  phone: z.string().min(7).max(20),
  notes: z.string().max(2000).optional(),
});
```

### String input limits

All string inputs must define `min` and `max` character limits in both the Zod schema and the backend DTO. Display characters remaining **only on textareas and fields with limits under 200 characters where the user is likely to hit the limit**. Do not show character counts on short inputs like name or email.

### Inline validation icons

For fields that require uniqueness or format validation with server-side checks (email, phone), show inline icons within the input field:

- Loading spinner — while checking
- Checkmark — valid / available
- Cross — invalid / taken

For password fields, show a **strength meter** (weak/medium/strong) with a requirements checklist that checks off in real-time. Do not use a simple checkmark for passwords.

### Uniqueness / duplication checks

Run duplication checks **onBlur only**, not onChange. onChange fires on every keystroke and causes excessive server requests. Debounced onChange (300-500ms) is acceptable as an alternative but onBlur is preferred.

### Error display

- Show field errors below the input on blur.
- Do not show errors on untouched fields.
- Errors are announced to screen readers via `aria-live`.

### Multi-step forms

Multi-step forms preserve state across steps. The back button never loses data. Each step validates only its own fields before advancing.

---

## 4. Form Submission

### Prevent double submission

Disable the submit button immediately on click. Re-enable on error. Pattern:

```
click → disable button + show loading state
  → success → redirect or close
  → error   → re-enable button + show error toast
```

### Optimistic updates

Use optimistic updates **only for mutations where rollback is invisible to the user**:

- **Good:** toggling status, reordering lists, marking as read, favoriting
- **Bad:** creating new records (no ID yet), financial operations, anything with complex server-side validation

Always define an `onError` rollback that restores the previous state.

---

## 5. Tables — TanStack Table

### URL-synced state

Pagination, sorting, and filtering state must be synced to URL query params:

```
/candidates?page=2&sort=name&status=active&search=john
```

Users must be able to share and bookmark a filtered view. Never store table state only in React state.

### Pagination defaults

- Default page size: 25
- Page size options: 10, 25, 50, 100

### Column visibility

Column visibility should be toggleable by the user and persisted to `localStorage`. Preferences are restored on return.

### Search

Debounce search input by 300ms. Never fire an API call on every keystroke.

### Filter chips

When filters are active, show them as removable chips above the table:

```
Status: Active ✕  |  Role: Developer ✕  |  Clear all
```

Users can remove individual filters or clear all at once.

### Responsive behavior

Tables collapse to a card/list view on mobile. No horizontal scrolling.

---

## 6. Routing

### Tabs as nested routes

Tabbed views use nested routes, not query params:

```
/candidates/123/overview
/candidates/123/interviews
/candidates/123/documents
```

Each tab is a separate route. Browser back/forward navigates between tabs.

### Modals use React state

Opening a modal does NOT change the URL. Modals are transient UI state managed via `useState`. They are not deep-linkable.

### Code splitting

Lazy load at the route level. Each portal's pages load only when navigated to:

```tsx
const UsersPage = React.lazy(
  () => import("@portals/admin/pages/UsersPage")
);
```

Wrap lazy routes in `<Suspense fallback={<PageSkeleton />}>` to show a skeleton while the chunk loads.

---

## 7. Loading, Empty & Error States

Every data-driven view must handle three states:

### Loading

Show skeleton loaders that match the layout shape. Never use a centered spinner on a blank page. Skeletons give spatial context of what is loading.

### Empty

Show an icon + descriptive message + call-to-action:

```
[icon]
No candidates yet
Add your first candidate to get started.
[+ Add Candidate]
```

Never show a blank page or just "No data."

### Error

Show an error message + retry button. Never show only red text with no action:

```
Something went wrong loading candidates.
[Retry]
```

---

## 8. Error Boundaries

Use React error boundaries at **two levels**:

1. **Per-portal** — wraps each portal's routes. A crash in admin doesn't take down client.
2. **App root** — last-resort fallback for anything that escapes portal boundaries.

Portal-level fallback shows "Something went wrong in this section" with a "Reload" button. App-level fallback shows a full-page error with a "Reload app" button.

---

## 9. Authentication & Route Protection

### Auth state

Use TanStack Query to fetch and cache the current user:

```ts
const useAuth = () =>
  useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/auth/me"),
    staleTime: Infinity,
  });
```

### Protected routes

Wrap protected routes in an `AuthGuard` component. Public routes (login, forgot password) sit outside it:

```tsx
<Route element={<AuthGuard />}>
  <Route path="/candidates" element={<CandidateListPage />} />
  {/* all protected routes */}
</Route>
<Route path="/login" element={<LoginPage />} />
```

`AuthGuard` checks auth state. If unauthenticated, redirects to `/login`.

### Token refresh

Silent refresh via `packages/ui/services` interceptor:

- Access token expires → API returns 401
- Interceptor calls `/auth/refresh` with refresh token
- Gets new access token, retries the failed request
- User never notices

### Session expiry

When the refresh token itself expires (user gone for days):

- Show a modal: "Your session has expired. Please log in again."
- Do NOT redirect immediately. Let the user copy any unsaved work.
- After login, return them to the page they were on.

---

## 10. RBAC in the UI

### Fetching permissions

On app load, `/auth/me` returns the user's permissions:

```ts
{ user: {...}, permissions: ["candidates.create", "candidates.read", "orders.read"] }
```

Stored in auth state via TanStack Query. Available everywhere.

### Hiding unauthorized elements

Use a `<Can>` wrapper component. **Default behavior is to hide**, not disable:

```tsx
<Can permission="candidates.delete">
  <DeleteButton />
</Can>
```

If the user lacks the permission, the element is not rendered. This applies to both navigation items and inline actions.

---

## 11. Global API Error Handling

Handled in `packages/ui/services` response interceptor:

| Status | Behavior |
|---|---|
| 401 | Trigger silent token refresh. If refresh fails, show session expiry modal. |
| 403 (action-level) | Toast: "You don't have permission to perform this action." |
| 403 (page-level) | Redirect to a "Not Authorized" page. |
| 500 | Toast: "Something went wrong. Please try again." |
| Network error | Show an "You're offline" banner. |

The interceptor handles generic errors globally. Portals and features can still catch specific errors (e.g., 409 "email already taken") in their own mutation's `onError`.

---

## 12. Toasts & Feedback

### Mutation feedback

All mutations (create, update, delete) show a toast on success or failure. Never let a mutation complete silently.

- Success: brief confirmation ("Candidate created")
- Error: describe what failed ("Failed to create candidate. Please try again.")

### Destructive actions

Destructive actions (delete, archive, remove) require a confirmation dialog:

- Confirm button label includes the action: "Delete candidate", not "Confirm" or "Yes".
- Confirm button uses a **danger variant** (red/destructive). Never the primary color.
- Include a description of consequences: "This will permanently delete the candidate and all associated data."

---

## 13. Dates

### Backend

See PROMPT-API.md for backend date rules. Two types of date fields come from the API: **timestamps** (ISO 8601 UTC, e.g. `2026-03-12T14:30:00.000Z`) and **calendar dates** (plain `YYYY-MM-DD`, e.g. `"2026-03-12"`).

### Frontend

| Concern | Rule |
|---|---|
| Library | `date-fns`. Tree-shakeable, no heavy dependencies. |
| Timestamps | Parse UTC from API. Display in the user's local timezone. |
| Calendar dates | Display as-is. **No timezone conversion.** A DOB of `2026-03-12` displays as March 12 everywhere. |
| Form state | Store date values as ISO strings (timestamps) or `YYYY-MM-DD` strings (calendar dates), never as `Date` objects. |
| Date pickers | Always use the shared `FormDatePicker` from `@packages/ui/components/form/`. |

### Display formats

Define shared formatting utilities:

```ts
formatDate(iso)         // → "Mar 11, 2026"
formatDateTime(iso)     // → "Mar 11, 2026 2:30 PM"
formatRelative(iso)     // → "3 hours ago"
```

All date display goes through these utilities. Never call `date-fns` format functions directly in components.

---

## 14. Currency

### Backend

See PROMPT-API.md for backend currency rules. Key contract: API transmits amounts as integers (cents) with a currency code: `{ amount: 12550, currency: "USD" }`.

### Frontend

| Concern | Rule |
|---|---|
| Display | Format using `Intl.NumberFormat`. One shared `formatCurrency(amountInCents, currencyCode)` utility. |
| Form input | Accept decimal (`125.50`). Convert to cents before sending to API. |
| Validation | No negative values unless the field represents credits/refunds. Max 2 decimal places. |

```ts
formatCurrency(12550, "USD")  // → "$125.50"
formatCurrency(99900, "EUR")  // → "€999.00"
```

---

## 15. Phone Numbers

### Backend

See PROMPT-API.md for storage rules. Key contract: API stores and returns E.164 format (`+15551234567`).

### Frontend

| Concern | Rule |
|---|---|
| Input | Use the shared `FormPhoneInput` component from `@packages/ui/components/form/`. |
| Display | Format per locale using `libphonenumber-js`. `+15551234567` → `(555) 123-4567` for US. |
| Form state | Store the raw user input during editing. Convert to E.164 before sending to API. |

### `FormPhoneInput` component (`@packages/ui/components/form/`)

A shared phone input component used everywhere a phone number is collected. Never build a one-off phone input in a feature.

- **Country code selector** — dropdown with country flag + dial code (`+1`, `+44`, `+91`). Defaults based on user locale.
- **Number input** — standard text input for the local number.
- **Validation** — integrates with `libphonenumber-js` to validate the combined country code + number. Shows inline error for invalid numbers.
- **Output** — produces E.164 format (`+15551234567`) for form state.
- **React Hook Form integration** — works with `Controller` like all other `Form*` components in `@packages/ui/components/form/`.

---

## 16. Email Addresses

### Backend

See PROMPT-API.md for storage rules. Key contract: API lowercases emails before storage.

### Frontend

| Concern | Rule |
|---|---|
| Input | Standard email input. No client-side lowercasing — the API handles it. |
| Validation | Inline validation onBlur — check format and uniqueness (see section 3). |
| Display | Display as stored (lowercase). |

---

## 17. Passwords

### Frontend

| Concern | Rule |
|---|---|
| Input | Use `type="password"` with a show/hide toggle. |
| Strength | Show a strength meter (weak/medium/strong) with a real-time requirements checklist. No simple checkmark. |
| Validation | Validate requirements client-side for UX. The server is the authority. |
| Submission | Never log. Never store in browser state beyond the form. Clear on unmount. |

---

## 18. Percentages

### Backend

See PROMPT-API.md for storage rules. Key contract: API transmits as basis points (integer). `15.5%` = `1550`.

### Frontend

| Concern | Rule |
|---|---|
| Display | One shared `formatPercentage(basisPoints)` utility. `1550` → `15.5%`. |
| Form input | Accept decimal (`15.5`). Convert to basis points before sending to API. |
| Validation | Range check (0–10000 for 0–100%). Allow decimals to 2 places. |

```ts
formatPercentage(1550)   // → "15.5%"
formatPercentage(10000)  // → "100%"
```

---

## 19. User Timezone

### Backend

See PROMPT-API.md for storage rules. Key contract: `/auth/me` returns the user's IANA timezone (nullable). Frontend falls back to browser timezone if not set.

### Frontend

| Concern | Rule |
|---|---|
| Detection | `Intl.DateTimeFormat().resolvedOptions().timeZone` for browser default. |
| Preference | User can set their timezone in profile settings. Stored on the server. |
| Resolution | `userPreference ?? browserTimezone`. The auth context provides the resolved value. |
| Display | All `formatDateTime` and `formatRelative` calls use the resolved timezone. `formatDate` (date-only) is unaffected — calendar dates have no timezone. |

```ts
const timezone = authUser.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
formatDateTime(iso, { timezone })  // → "Mar 11, 2026 2:30 PM ET"
```

---

## 20. Accessibility

- All interactive elements are keyboard navigable.
- Form errors are announced via `aria-live` regions.
- Modals trap focus and close on `Escape`.
- Color is never the sole indicator of state — always pair with an icon or text label.
- Images and icons that convey meaning have `alt` text or `aria-label`.
- Focus rings are visible on keyboard navigation, hidden on mouse click.

---

## 21. Responsive Design

- Tables collapse to card/list view on mobile.
- Modals become full-screen sheets on mobile.
- Sidebar collapses to a hamburger menu on small screens.
- Touch targets are at least 44x44px on mobile.
- No horizontal scrolling on any screen size.
