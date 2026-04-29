# Modular Starter Template — Architectural Specification

This document defines the architecture, rules, and conventions for the monorepo.

This is a **modular library stack**, not a configuration framework. Apps compose libraries from four layers — `core` + `platform` (foundation), `addons` (opt-in capabilities), `domains` (business verticals), and `apps` (deployable products). The vision and dependency rules live in `CLAUDE.md` (`## Project Vision`); this file covers the rules, conventions, and patterns that follow from it.

---

## Tech Stack

- **Runtime:** Node.js with TypeScript (strict mode)
- **Backend:** NestJS | **Frontend:** React + Vite + React Router
- **Database:** PostgreSQL | **ORM:** Drizzle ORM
- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend state:** TanStack Query (server) + React local state (UI)
- **No Redux. No Next.js. No SSR.**

---

## Top-Level Folder Structure

```
starter-template/
├── apps/                   # Deployable products that compose domains + addons
├── domains/                # Self-contained business verticals (recruit, compliance, agency, ...)
├── packages/
│   ├── core/               # Foundation — framework-free primitives
│   ├── platform/           # Foundation — NestJS-bound infra + UI shells
│   └── addons/             # Opt-in capabilities (entity-engine, workflows, hierarchy, ...)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

Dependency direction, module boundaries, and event conventions are defined in `.claude/rules/`. Those rules are auto-loaded every conversation.

---

## 1. Apps Layer — Composition Roots

Apps are deployable products. They contain minimal business logic — their job is to compose domains and addons into a runnable product, plus add app-specific entities, screens, and cross-domain wiring.

### Per-app structure

```
apps/<app>/
  api/                    # NestJS backend composition root
    src/
      app.module.ts       # imports foundation + addons + domains
      modules/            # app-specific entities (rare; most live in domains/)
  web/                    # React + Vite frontend (see PROMPT-UI.md)
    src/
      portals/            # user-facing surfaces (admin, customer, public)
      cross-domain/       # composition that spans multiple domains
      shared/             # portal-level shared UI
      main.tsx
```

The `app.module.ts` is the composition root — it imports the foundation packages, the opt-in addons the app uses, and the domain manifests for each business vertical. No controllers, services, or domain logic live in `apps/<app>/api/src/` outside `modules/`, and `modules/` is reserved for entities that genuinely belong to *this app only* (everything reusable graduates to a domain or addon).

### Worker — Background Job Processing

No separate worker app. The same backend codebase runs with different env flags:

- `API_ENABLED=true, WORKER_ENABLED=true` — dev/demo (one container)
- Production: two containers from the same image with different flags

Flow: domain event → side-effect handler enqueues a job → worker picks it up → executes with retries.

---

## 2. Modules Layer — Backend Domain Logic

Each module represents a business entity as a standalone NestJS module. Modules live in two places:

- **`domains/<domain>/api/modules/<module-name>/`** — the default. Entities that belong to a business vertical (e.g. recruit's `candidates`, compliance's `laws`, agency's `pages`).
- **`apps/<app>/api/src/modules/<module-name>/`** — for entities that genuinely belong to *one app only* and aren't reusable across products.

### Module Structure

```
<owner>/<module-name>/
  controllers/              # REST endpoints
  services/                 # Business logic + DB access
  events/
    types.ts                # Event payload interfaces + constants
  dto/                      # Request/response validation (class-validator)
  permissions.ts            # Permission constants
  <module-name>.module.ts   # NestJS module + event/permission registration
  schema.ts                 # Drizzle table definitions
  index.ts                  # Public API surface
```

### Module Rules

Core rules (ownership, public API, cross-module imports, domain-only services, events, enums, permissions) are in `.claude/rules/module-boundaries.md`.

Additional:
- Each module registers event metadata and permissions with registries in `onModuleInit`.
- Controllers use permission constants: `@RequirePermission(CANDIDATES_PERMISSIONS.CREATE)`
- The UI discovers permissions via `GET /api/v1/permissions/registry`.

### Domain vs Side-Effect Decision

| Question | If yes → |
|---|---|
| Core business logic for this entity? | Domain → module service |
| Needs data/action from another module? | Direct call → import public API |
| Reaction the emitter doesn't need to know about? | Side effect → emit event |
| Generic capability (notifications, logging)? | Side effect → existing package |

---

## 3. Event System

Events decouple domain logic from side effects. Core rules are in `.claude/rules/event-conventions.md`.

### Event Registry

Modules register event metadata in `onModuleInit` so platform UIs can discover available events:

```ts
this.eventRegistry.register({
  eventName: CANDIDATES_CANDIDATE_SUBMITTED,
  entityType: "candidate",
  description: "Fired when a candidate is submitted to an order",
  payloadSchema: { orderId: { type: "string", label: "Order ID" } },
});
```

### Event Producer Pattern

```ts
async submitCandidate(dto, actorId) {
  const order = await this.ordersService.getById(dto.orderId);  // direct call
  const [candidate] = await this.database.db.update(candidates)...  // own operation
  this.eventEmitter.emit(CANDIDATES_CANDIDATE_SUBMITTED, { ...eventPayload });
  return candidate;
}
```

### Event Consumer Pattern

Side-effect packages subscribe generically — no module imports:

```ts
@OnEvent("**")
async handleAnyEvent(event: DomainEvent) {
  // Activity log: write to DB inline (lightweight)
  // Notifications: find rules in DB → enqueue job via packages/platform/queue
}
```

---

## 4. Packages Layer — Composable Libraries

Packages are organized into two tiers, in dependency order:

| Tier | Folder | Role | Examples |
|---|---|---|---|
| Foundation | `packages/core/` | Framework-free primitives (no NestJS, no UI shell) | common, database, events, query-builder, ui, soft-delete, logger, testing |
| Foundation | `packages/platform/` | NestJS-bound infra + cross-cutting UI shells | rbac, audit, auth, settings, queue, notifications, users, app-shell, platform-ui, theming-ui, dashboard-ui |
| Addons | `packages/addons/` | Opt-in capabilities apps and domains import as needed | entity-engine, entity-layout, field-types, workflows, automations, hierarchy, taxonomy, media, evaluations, tasks, attachments, oauth, tenancy, ... |

`core/` and `platform/` are two folders for the same conceptual tier (foundation). Together they form the substrate every app depends on. Addons sit on top — they may depend on foundation + other addons. Apps and domains may depend on both.

### Library, not framework

Foundation and addon packages are **libraries you call**, not frameworks that own your app's lifecycle.

- A package's public API is a service you import (e.g. `RbacService`, `EventEmitter`, `AuditService`) plus its types and constants. Apps and domains call these explicitly.
- Cross-cutting concerns are abstracted *away*, not generated *for* you. Adding RBAC to a controller is a `@RequirePermission(...)` decorator. Emitting an event is `eventEmitter.emit(...)`. Auditing is event-driven and automatic — domains never call an audit service directly.
- Generation-style APIs (`defineEntity()`, generic CRUD controllers, dynamic form rendering) are *opt-in addons*, not the central platform contract. Hand-written services + controllers + forms are equally first-class. Domains pick what they need on a per-entity basis.

### Package Design Rules

1. **No domain knowledge.** Foundation and addon packages know nothing about candidates, laws, orders, or any business entity. They expose generic primitives (entities, fields, events, permissions) — not domain types.
2. **Self-contained.** Own `package.json`, own tests, own migrations (where applicable). Built and published independently.
3. **Narrow public API.** Export from `index.ts` only — services, types, constants, event names. DTOs and internal helpers stay internal.
4. **Swappable implementations.** Interfaces over concrete classes. Channel providers, storage backends, identity stores all plug in via a defined interface.
5. **Side effects via events.** When a package needs to react to other modules' actions, it subscribes to events generically (`@OnEvent("**")` + filter), never imports from app modules.
6. **DB-driven runtime config where it pays off.** Layouts, settings, workflow states are admin-editable because the cost of plumbing is amortized across many entities. One-off feature flags or per-app constants stay in code.
7. **No new platform plumbing without solid reasoning.** New registries, lifecycle hooks, or `EntityConfig` fields are load-bearing forever. Default to extending via service composition in `domains/` or `apps/`. See `.claude/rules/` and the "What NOT to Do" section in CLAUDE.md.

### Cross-cutting addon: `@packages/addons/hierarchy`

Use for any tree-structured entity. Provides `hierarchyColumns()`, `HierarchyService` (ancestors, descendants, move with cycle detection), and `buildTree()`.

**Rules:** Always use `hierarchyColumns()` for tree tables. Always use `HierarchyService` — never walk parents in a loop. Index the `path` column.

---

## 5. Database

### Schema Organization

Schemas and migrations live with their owning package, not in a single central directory. Each layer ships its own:

- **Foundation packages** (`packages/core/*`, `packages/platform/*`) — kernel-tier tables (users, sessions, audit, settings, queue jobs, ...). Migrations bundled with the package.
- **Addon packages** (`packages/addons/*`) — addon-owned tables (workflow states, automations, layouts, fields, taxonomies, ...). Migrations ship as part of the addon bundle.
- **Domain packages** (`domains/*`) — domain entity tables (candidates, laws, pages, ...). Migrations ship with the domain.
- **Apps** (`apps/*`) — app-specific entity tables, if any. Rare in practice.

Apps compose this by passing the addons they use into `createAppModule({ addons })` and `runAppMigrations({ addons })` — the runtime collects schemas and migrations from each layer in dependency order.

### Commands

- `pnpm db:generate` → new migration SQL from schema changes
- `pnpm db:migrate` → apply pending migrations for the current app
- `pnpm db:push` → push schema directly (dev only)

### DB Access Rules

See `.claude/rules/module-boundaries.md`. Key points: each module queries only its own tables, cross-module data via services, FK columns allowed but no cross-module joins.

---

## 6. Monorepo Configuration

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": { "@packages/*": ["./packages/*"] }
  }
}
```

---

## 7. Code Quality Rules

- All TypeScript strict mode.
- No circular dependencies between modules.
- No domain logic in packages. No side effects in domain services.
- Event names: namespaced, past-tense, exported constants.
- Side-effect handlers: idempotent. Unreliable I/O via `packages/platform/queue`.
- No `console.log` — use structured logger.
- Data formatting: see `.claude/rules/data-formatting.md`.
