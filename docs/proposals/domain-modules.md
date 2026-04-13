# Proposal: Domain Modules — Multi-App Support on a Single Platform

**Status:** Draft, awaiting review
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

```
domains/recruit/
  package.json                    # @domains/recruit
  src/
    manifest.backend.ts           # backend manifest export
    manifest.web.ts               # web manifest export
    backend/
      recruit.module.ts           # NestJS module aggregating entity modules
      candidates/
        candidates.schema.ts      # Drizzle table in `public`
        candidates.service.ts
        candidates.controller.ts
        candidates.events.ts
        candidates.entity.ts      # defineEntity() config
      jobs/
      applications/
      permissions.ts              # ['recruit.candidates.create', ...]
      migrations/                 # drizzle migrations, target `public`
    web/
      features/
        candidates/               # pages, forms, tables, hooks
        jobs/
      navigation.ts               # sidebar sections
      routes.ts                   # React Router route objects
```

### Subpath exports

A single domain package exposes two entry points so `apps/api` and `apps/web` only pull what they need. Without this, the browser bundle would try to include NestJS and the Node bundle would try to include React.

```json
{
  "name": "@domains/recruit",
  "exports": {
    "./backend": "./src/manifest.backend.ts",
    "./web": "./src/manifest.web.ts"
  }
}
```

### Two manifests per domain

Backend and frontend types cannot share a file (NestJS decorators, Drizzle schemas, and React components live in different build targets). Each domain exposes two manifests, each consumed by one app.

```ts
// manifest.backend.ts
import { RecruitModule } from './backend/recruit.module';
import { candidateEntity, jobEntity, applicationEntity } from './backend/entities';
import { RECRUIT_PERMISSIONS } from './backend/permissions';

export const recruitBackend = {
  name: 'recruit',
  displayName: 'Recruit',
  module: RecruitModule,                    // NestJS module class
  permissions: RECRUIT_PERMISSIONS,         // string[]
  entities: [candidateEntity, jobEntity, applicationEntity],
};
```

```ts
// manifest.web.ts
import { recruitNavigation } from './web/navigation';
import { recruitRoutes } from './web/routes';

export const recruitWeb = {
  name: 'recruit',
  displayName: 'Recruit',
  navigation: recruitNavigation,
  routes: recruitRoutes,
};
```

Manifest type definitions live in `packages/platform/common` (or a similar existing shared platform package). No new `domain-engine` package is needed — wiring is plain imports.

### How the apps consume manifests

**`apps/api/src/app.module.ts`:**

```ts
import { recruitBackend } from '@domains/recruit/backend';
import { crmBackend } from '@domains/crm/backend';

const enabledDomains = [recruitBackend, crmBackend];

@Module({
  imports: [
    // ...core + platform + addon modules
    ...enabledDomains.map((d) => d.module),
  ],
})
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    for (const domain of enabledDomains) {
      this.permissionRegistry.registerMany(domain.permissions);
      this.entityEngine.registerMany(domain.entities);
    }
  }
}
```

No `DomainEngineModule.forRoot` wrapper, no registry service. Just loop the imported manifests in `onModuleInit` and call the existing platform registries.

**`apps/web/src/App.tsx`:**

```tsx
import { recruitWeb } from '@domains/recruit/web';
import { crmWeb } from '@domains/crm/web';

const enabledDomains = [recruitWeb, crmWeb];

// Merge all navigation sections into the sidebar.
// Mount all routes under the authenticated shell.
// Existing permission-based filtering handles visibility per user.
```

Adding a third domain is a two-line diff in each app. Nothing else.

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

Enforced by ESLint import-path rules and the existing `pnpm lint` boundary check.

---

## Migration Path From Current State

High-level. Detailed migration is a follow-up.

1. Create `domains/recruit/` as an empty workspace package with manifest stubs.
2. Move recruit-specific backend modules from their current location into `domains/recruit/src/backend/`. Update imports. Tests stay green at each step.
3. Move recruit-specific frontend features into `domains/recruit/src/web/features/`.
4. Extract recruit navigation from the app's sidebar component into `domains/recruit/src/web/navigation.ts`.
5. Wire `recruitBackend` and `recruitWeb` into the app's `AppModule` and `App.tsx`.
6. Delete the old locations once nothing imports them.
7. Add the new dependency rule to `.claude/rules/dependency-direction.md`.
8. Add an ESLint boundary rule to enforce the direction.

No schema move. No data migration. Tables stay where they are — only the code that owns them moves.

CRM (or any second domain) is built only after Recruit is cleanly extracted and the lint boundary is in place.

---

## Recommendation

Approve this structure. Start with the Recruit extraction — the goal is to land the `domains/` tier, prove the manifest pattern with one real domain, and get the dependency lint enforcing the new rule. A second domain is what validates the proposal; it should land in a codebase where the rules are already enforced.
