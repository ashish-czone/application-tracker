# Modular Starter Template — Architectural Specification

This document defines the architecture, rules, and conventions for the monorepo.

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
├── apps/
│   ├── api/                # NestJS backend
│   │   └── src/modules/    # Backend domain modules
│   └── web/                # React + Vite frontend (see PROMPT-UI.md)
├── packages/               # Reusable, domain-agnostic packages
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

Dependency direction, module boundaries, and event conventions are defined in `.claude/rules/`. Those rules are auto-loaded every conversation.

---

## 1. Apps Layer — Thin Orchestrators

Apps contain NO business logic. They only wire things together.

### apps/api/

`app.module.ts` is the composition root — imports all domain modules and platform packages. No controllers, services, or logic here.

### apps/web/

See PROMPT-UI.md for the full frontend architecture.

### Worker — Background Job Processing

No separate `apps/worker/`. The same `apps/api/` codebase runs with different env flags:

- `API_ENABLED=true, WORKER_ENABLED=true` — dev/demo (one container)
- Production: two containers from same image with different flags

Flow: domain event → side-effect handler enqueues a job → worker picks it up → executes with retries.

---

## 2. Modules Layer — Backend Domain Logic

Each module represents a business entity as a standalone NestJS module.

### Module Structure

```
apps/api/src/modules/<module-name>/
  controllers/              # REST endpoints
  services/                 # Business logic + DB access
  events/
    types.ts                # Event payload interfaces + constants
  dto/                      # Request/response validation (class-validator)
  permissions.ts            # Permission constants
  <module-name>.module.ts   # NestJS module + event/permission registration
  schema.ts                 # Drizzle table definitions (source of truth; centralized in packages/core/database/schema/)
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

## 4. Packages Layer — Reusable, Domain-Agnostic

### Package Categories

| Category | Role | Examples |
|---|---|---|
| Infrastructure (backend) | Low-level plumbing | database, events, queue |
| Platform Capabilities (backend) | Cross-cutting engines called directly | hierarchy, rbac, settings, taxonomy, entity-engine, media |
| Side-Effect Packages (backend) | Event-driven, generic reactors | notifications, audit, reminder-engine |
| Frontend | Shared UI toolkit + feature UI | `packages/core/ui`, `packages/{platform,addons}/*-ui` |
| Shared (both) | Pure types/constants | common (`PaginatedResponse<T>`, `BaseEntity`) |

Platform packages may include their own controllers, DTOs, and permissions when they provide a self-contained feature.

### Package Design Rules

1. No domain knowledge — never imports from app modules.
2. Self-contained with own `package.json`.
3. Swappable implementations (interfaces over concrete).
4. DB-driven configuration, not hardcoded logic.
5. Feature UI packages (`packages/*-ui`) are domain-agnostic — work with any entity type.

### Hierarchy Package (`@packages/hierarchy`)

Use for any tree-structured entity. Provides `hierarchyColumns()`, `HierarchyService` (ancestors, descendants, move with cycle detection), and `buildTree()`.

**Rules:** Always use `hierarchyColumns()` for tree tables. Always use `HierarchyService` — never walk parents in a loop. Index the `path` column.

---

## 5. Database

### Schema Organization

All Drizzle schemas in `packages/core/database/schema/`, organized by module.

```
packages/core/database/
  schema/           # Table definitions (one file per module)
    index.ts        # barrel export
  drizzle/          # generated migrations (committed)
  drizzle.config.ts
  index.ts          # DatabaseService + DatabaseModule + re-exports
```

### Commands

- `pnpm db:generate` → new migration SQL from schema changes
- `pnpm db:migrate` → apply pending migrations
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
