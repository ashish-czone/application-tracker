# Proposal: Domain Modules — Multi-App Support on a Single Platform

**Status:** Landed (Recruit extraction complete)
**Author:** Ashish
**Date:** 2026-04-13

---

## Summary

Introduce a new top-level `domains/` tier, parallel to `packages/` and `apps/`, so that vertical-specific code (Recruit, CRM, ERP, ...) lives in self-contained packages that can be dropped into any app. The platform core, platform packages, and addons remain domain-agnostic. An app imports whichever domains it wants and their menus, routes, entities, and permissions are merged into a single running instance.

Demoing different apps is handled by running the same codebase against different databases, not by gating domains at runtime inside one process.

---

## Motivation

The platform is already domain-agnostic: entity engine, field types, workflows, RBAC, audit, automations, notifications, layouts, and taxonomy have zero knowledge of business entities. Today, the only "domain" code lives inside the app folder, which means:

- Adding a second vertical (CRM) means polluting the existing app with foreign concepts.
- There is no physical boundary preventing a future developer from mixing CRM code into Recruit.
- A domain's entities, permissions, and navigation cannot be composed as a unit.

Extracting domains into their own tier makes the vertical the unit of composition, and makes the app a thin orchestration layer that imports whichever domains it needs.

---

## Goals

1. Multiple domains (Recruit, CRM, ERP, HR, ...) live as self-contained packages in a single repo.
2. `packages/core`, `packages/platform`, and `packages/addons` stay strictly domain-agnostic.
3. An app may import one or more domains. Their menus, routes, entities, and permissions merge into one running instance.
4. No cross-domain coupling — domains never import from other domains.
5. Demos of different verticals are handled by separate databases, not by runtime gating.

## Non-goals

- Runtime enable/disable of domains inside one process.
- Per-domain Postgres schemas or search-path separation.
- A dedicated domain-engine orchestration layer.
- Cross-domain isolation enforcement (access control is still permissions-based, but we don't build a test harness to prove isolation).
- Multi-tenancy. Orthogonal.
- Detailed migration of existing app code into the new structure — a follow-up.

---

## Proposed Architecture

### New top-level tier

```
apps/
packages/
  core/
  platform/
  addons/
domains/               # NEW
  recruit/
  crm/
  ...
```

Domains are workspace packages scoped as `@domains/*`. The tier is encoded by folder, not by name — same convention as existing packages.

### Domain package layout

A domain is a **folder** containing two sibling workspace packages — one for backend code, one for web code. The parent folder (`domains/recruit/`) is not itself a package. This matches the platform-package colocation pattern already used by `packages/platform/entity-engine/{backend,ui}` and `packages/platform/notification-channels/{backend,ui}`.

```
domains/recruit/
  backend/
    package.json                  # @domains/recruit-backend
    index.ts                      # exports recruitBackend manifest
    recruit.module.ts             # NestJS module aggregating entity modules
    candidates/
      schema/candidates.ts        # Drizzle table in `public`
      candidates.service.ts
      candidates.controller.ts
      candidates.events.ts
      candidates.config.ts        # defineEntity() config
    job-openings/
    applications/
    interviews/
    offers/
    ...
  web/
    package.json                  # @domains/recruit-web
    index.tsx                     # exports recruitWeb manifest
    entities/                     # UI-side entity config overrides
    portals/recruiter/features/   # pages, forms, tables, hooks
    lib/                          # domain-specific frontend helpers
```

### Why two packages, not one with subpath exports

Splitting into `@domains/recruit-backend` and `@domains/recruit-web` gives honest dependency graphs: each `package.json` declares only what that side actually uses, so the Nest app never resolves React and the Vite build never resolves Nest. With a single package using subpath exports, the dep graph lies and correctness relies on bundler tree-shaking.

Install size on disk is unchanged (pnpm hard-links), and bundle sizes are determined by the import graph, not the package count. Splitting can only make bundles smaller or equal, never larger.

### Two manifests per domain

Backend and frontend types cannot share a file (NestJS decorators, Drizzle schemas, and React components live in different build targets). Each sibling package exposes exactly one manifest, consumed by one app.

```ts
// domains/recruit/backend/index.ts
import type { DomainBackendManifest } from '@packages/domains';
import { RecruitDomainModule } from './recruit.module';

export const recruitBackend: DomainBackendManifest = {
  name: 'recruit',
  displayName: 'Recruit',
  module: RecruitDomainModule,
};
```

```ts
// domains/recruit/web/index.tsx
import type { DomainWebManifest } from '@packages/domains';
import { EntityCreatePage } from '@packages/entity-engine-ui';
// lazy-loaded feature pages...

export const recruitWeb: DomainWebManifest = {
  name: 'recruit',
  displayName: 'Recruit',
  routes: [
    { path: '/', element: <DashboardPage /> },
    { path: '/templates', element: <TemplatesPage /> },
    { path: '/job-openings/new', element: <EntityCreatePage entityType="job_openings" /> },
    { path: '/interviews/calendar', element: <InterviewsCalendarPage /> },
  ],
  detailPageOverrides: {
    candidates: CandidateProfilePage,
    job_openings: JobOpeningDetailPage,
    applications: ApplicationDetailPage,
  },
};
```

Manifest type definitions live in `@packages/domains`. No new `domain-engine` package is needed — wiring is plain imports.

### What the manifest does **not** contain

The manifest is intentionally small. Several fields that the first draft suggested turned out to be redundant once we traced how the existing platform already handles them:

- **No `permissions: string[]`** — each entity registers its own permissions in `onModuleInit()` via the permission registry. `defineEntity()` + `EntityEngineModule.forEntity()` already wire this up per entity. Listing permissions in the manifest would duplicate what the entity configs declare.
- **No `entities: EntityConfig[]`** — same reason. The Nest module already imports each entity module, which calls `EntityEngineModule.forEntity(config)` to register itself with the entity engine. There is nothing left for the manifest to do.
- **No `navigation: NavigationSection[]`** — the web app already fetches the entity registry from `GET /entity-engine/registry` and renders sidebar items via `<EntityNavItems>`, filtered by the current user's permissions. A domain does not need to ship a static navigation tree; entity nav is data, not code. Cross-domain non-entity nav items (a "Reports" section, a custom dashboard link) could be added later as a small `navigation?: NavigationItem[]` field if the need arises.

The manifest only carries what is genuinely app-level wiring: the Nest module to import on the backend, and on the frontend, custom routes (for pages that are not entity list/detail) plus per-entity detail-page overrides (for entities whose generic detail page needs to be replaced with a richer custom view — e.g. the candidate profile).

### How the apps consume manifests

**`apps/recruit/src/app.module.ts`:**

```ts
import { recruitBackend } from '@domains/recruit-backend';

@Module({
  imports: [
    // ...core + platform + addon modules
    recruitBackend.module,
    // for a second domain: crmBackend.module,
  ],
})
export class AppModule {}
```

That is the whole integration. No `DomainEngineModule.forRoot` wrapper, no registry service, no `onModuleInit` loop. The Nest module itself pulls in each entity's module, and each entity registers its own permissions and entity-engine config in its own `onModuleInit`.

**`apps/recruit-web/src/app/router.tsx`:**

```tsx
import { recruitWeb } from '@domains/recruit-web';
import type { DomainWebManifest } from '@packages/domains';
import { useEntityEngine, EntityListPage } from '@packages/entity-engine-ui';

const enabledDomains: DomainWebManifest[] = [recruitWeb /*, crmWeb */];

export function AppRouter() {
  const { entities } = useEntityEngine();                  // data from GET /entity-engine/registry
  const detailOverrides = mergeDetailOverrides(enabledDomains);
  const domainRoutes = mergeDomainRoutes(enabledDomains);

  return (
    <Routes>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          {/* Registry-driven list + detail per registered entity. */}
          {entities.map((e) => {
            const Override = detailOverrides[e.entityType];
            return [
              <Route key={`${e.entityType}-list`}   path={`/${e.slug}`}     element={<EntityListPage entityType={e.entityType} />} />,
              <Route key={`${e.entityType}-detail`} path={`/${e.slug}/:id`} element={Override ? <Override /> : <AppEntityDetailPage entityType={e.entityType} />} />,
            ];
          })}
          {/* Domain-contributed custom pages. */}
          {domainRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          {/* ...platform routes (users, roles, automations, etc.) */}
        </Route>
      </Route>
    </Routes>
  );
}
```

Adding a second domain is a two-line diff: import its manifest, append it to `enabledDomains`. Everything else flows from the registry and from the merged detail-override / custom-route maps.

### Database

Single database, single `public` schema. Domain tables sit alongside platform tables. No `pgSchema()`, no search-path tricks, no per-schema migration runner. Each domain's `migrations/` folder targets `public` like every other package's migrations do today.

Table names must be globally unique, so domain tables are named with enough specificity to avoid collision (`candidates`, `jobs`, `job_applications`, etc.). Two domains that both want a `contacts` table is a signal that the concept should graduate to a platform package — not a signal that we need schema separation.

Demoing different verticals is handled at the database level:

- One DB per demo (`recruit_demo`, `crm_demo`, `combined_demo`).
- The API is started pointing at the right DB via `DATABASE_URL`.
- The set of enabled domains in the code is whatever matches the demo — or simply "all of them," since the unused ones contribute nothing at runtime if the demo data doesn't exercise them.

### Namespaced permissions

Permissions keep the existing `module.action` convention, extended to `domain.entity.action`:

```
recruit.candidates.create
recruit.candidates.read
crm.leads.create
crm.deals.close
```

The sidebar already filters `NavigationSection`s by the current user's permissions. That mechanism is enough — no additional access-control layer is needed. A user whose role grants only `recruit.*` sees only Recruit menus, even when CRM is loaded in the same process.

### Dependency rules

One new tier added to the existing rules:

```
apps/*              →  packages/{core,platform,addons}/* + domains/*
domains/*           →  packages/{core,platform,addons}/*
                       NEVER other domains
                       NEVER apps/*
packages/addons/*   →  packages/{core,platform}/*   (never other addons)
packages/platform/* →  packages/core/* + other platform
packages/core/*     →  other core only
```

- A domain may freely use any addon — addons are themselves domain-agnostic.
- A domain may never import from another domain. If two domains need a shared concept, that concept graduates to a platform package.
- A platform or addon package may never import from a domain. The direction is strictly one-way.
- `apps/*` imports only domain *manifests*, never a domain's internal files. The manifest is the public API of a domain.

Enforced by `eslint-plugin-boundaries` via `eslint.boundaries.config.mjs` at the repo root. `pnpm lint` runs the boundary-only flat config, which is independent of the main ESLint config so that pre-existing style issues cannot mask boundary violations.

---

## What Landed

The Recruit extraction is complete. Commits of interest:

- **feat(domains): move recruit-specific web features into @domains/recruit** (#749) — moved backend modules and frontend features into the new tier.
- **fix(recruit): bundle @domains/* into nest webpack output** (#750) — `apps/recruit` webpack config allowlists `@domains/*` so Nest bundles domain code instead of trying to resolve it as an external.
- **refactor(recruit): split @domains/recruit into backend + web packages** (this PR) — switched from a single package with subpath exports to two sibling packages (`@domains/recruit-backend`, `@domains/recruit-web`) for honest dep graphs.
- **chore(lint): add dependency-boundary ESLint config for package tiers** (this PR) — adds `eslint.boundaries.config.mjs` and wires `pnpm lint` to it.
- **feat(domains): extend DomainWebManifest with routes and detail overrides** (this PR) — final manifest shape.
- **feat(recruit-web): make AppRouter entity-registry driven** (this PR) — removed hardcoded per-entity routes; router now maps `useEntityEngine().entities` into list/detail routes with optional domain overrides.

No schema move. No data migration. Tables stay where they are — only the code that owns them moved.

CRM (or any second domain) is built only now that Recruit is cleanly extracted and the boundary lint is in place.

---

## Recommendation

Landed. The pattern is proven with Recruit. Follow-ups:

1. Document the pattern in `.claude/rules/dependency-direction.md` (the rule file is already updated; the proposal itself now matches).
2. Migrate `eslint-plugin-boundaries` from v5 `boundaries/element-types` to v6 `boundaries/dependencies` once the ecosystem stabilizes — currently the rule runs with a deprecation warning.
3. Extract a second domain (CRM) to validate that the manifest shape holds for a genuinely different vertical.
