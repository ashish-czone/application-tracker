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
packages/core/ui  ←  packages/{platform,addons}/*-ui  ←  domains/<x>/ui  ←  apps/<app>-web/src
```
- **`packages/core/ui`** — pure primitives. **`packages/{platform,addons}/*-ui`** — generic data widgets and opt-in plugins.
- **`domains/<x>/ui`** ships components, never pages. Allowed: `entity-configs/<entity>.ui.ts`, `components/<entity>/...`, `hooks/`, `services.ts`, `types/`. Forbidden: pages, routes, portals, layouts, navigation, `useParams`/`useNavigate`, imports from another domain or from `apps/*`.
- **`apps/<app>-web/src`** owns routing, screens, portals, cross-domain composition. Layout: `portals/<portal>/features/<feature>/`, `cross-domain/`, `shared/`, `main.tsx`.
- **Domain components take identity via props (`<CandidateDetail candidateId={id} />`), fetch data via hooks** — never via URL. That's how the same domain composes into multiple apps with different navigation.
- **Inside an app: features cannot import from each other.** Cross-feature reuse goes through portal-level `shared/`. Entity-engine is for cross-entity data, not cross-feature UI sharing.
- Full reference: `PROMPT-UI.md`.

### Routing
- Tabs as nested routes (`/candidates/123/overview`), not query params.
- Modals use React state, not URL. Not deep-linkable.
- Lazy load at route level with `<Suspense fallback={<PageSkeleton />}>`.

### Tables (TanStack Table)
- Pagination, sorting, filtering synced to URL query params.
- Search debounced by 300ms.
- Active filters shown as removable chips.

### Every data view handles: loading (skeletons), empty (icon + message + CTA), error (message + retry).
