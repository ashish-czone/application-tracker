## Frontend Conventions

### No barrel exports
Frontend code does NOT use barrel exports (`index.ts`). Use direct file imports to avoid circular dependencies and slow builds. (Backend modules and packages DO use `index.ts` as public API.)

### Component rules
- Never use native HTML form elements (`<input>`, `<select>`, `<textarea>`). Use `Form*` wrappers from `@packages/ui/components/form/`.
- All UI built on shadcn/ui + Radix UI + TailwindCSS. No second component library.
- Semantic color tokens only (`bg-background`, `text-foreground`). Never hardcode colors (`bg-white`).

### State management
- Server state: TanStack Query. UI state: React local state.
- No Redux. No global state libraries.

### Architecture layers
```
packages/ui  <-  packages/*-ui  <-  shared/  <-  portals/customer/features/
```
- Single portal (`customer`), feature-based grouping under `features/`.
- `shared/` for cross-cutting concerns (auth, notifications). Full-stack folders with components, hooks, services.
- Domain types live in the feature that owns them (`features/users/types/`), not shared.

### Routing
- Tabs as nested routes (`/candidates/123/overview`), not query params.
- Modals use React state, not URL. Not deep-linkable.
- Lazy load at route level with `<Suspense fallback={<PageSkeleton />}>`.

### Tables (TanStack Table)
- Pagination, sorting, filtering synced to URL query params.
- Search debounced by 300ms.
- Active filters shown as removable chips.

### Every data view handles: loading (skeletons), empty (icon + message + CTA), error (message + retry).
