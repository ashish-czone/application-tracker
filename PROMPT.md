# Modular Starter Template — Architectural Specification

This document defines the architecture, rules, and conventions for building a modular, event-driven monorepo. Follow every instruction exactly. Do not deviate, simplify, or skip any section.

---

## Tech Stack

- **Runtime:** Node.js with TypeScript (strict mode)
- **Backend framework:** NestJS
- **Frontend:** React + Vite + React Router
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend state:** TanStack Query (server state) + React local state (UI state)
- **No Redux. No Next.js. No SSR.**

---

## Top-Level Folder Structure

```
starter-template/
├── apps/                   # Deployable applications (thin orchestrators only)
│   ├── api/                # NestJS backend
│   │   └── src/modules/    # Backend domain modules (business logic)
│   └── web/                # React + Vite frontend
│       └── src/modules/    # Frontend domain features (UI logic)
├── packages/               # Reusable, domain-agnostic packages
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── package.json
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## Dependency Direction

Strictly enforced. Violations are build errors.

```
apps/api     →  packages/* (backend — runs as API, worker, or both via env flags)
apps/web     →  packages/* (frontend — UI, API client, auth-ui, common, etc.)
packages/*   →  other infrastructure packages only. NEVER import from apps/
```

Backend modules (`apps/api/src/modules/`) may import from `packages/*` and from other modules' public API (services, event types, enums) — no circular deps.

Frontend modules (`apps/web/src/modules/`) may import from `packages/*` (e.g., `packages/ui`, `packages/api-client`, `packages/auth-ui`, `packages/common`).

### When to use direct calls vs events

| Scenario | Mechanism | Example |
|---|---|---|
| Module A needs data from Module B | Direct call to B's public service API | `ordersService.getById(id)` |
| Module A needs Module B to perform an action | Direct call to B's public service API | `interviewsService.schedule(candidateId)` |
| Something happened and side effects should follow | Domain event | `emit(CANDIDATES_CANDIDATE_SUBMITTED, { ... })` |

**Rule of thumb:** If the caller needs the result or cares about failure → direct call. If the caller doesn't care who listens or what they do → event.

---

## 1. Apps Layer — Thin Orchestrators

Apps contain NO business logic. They only wire things together.

### apps/api/ — NestJS Backend

```
apps/api/
  src/
    main.ts                 # bootstrap NestJS
    app.module.ts           # imports all modules + packages, wires everything
  package.json
  tsconfig.json
```

`app.module.ts` is the composition root. It imports all domain modules and platform packages. No controllers, no services, no logic lives here.

```ts
@Module({
  imports: [
    // Infrastructure packages
    DatabaseModule,
    EventsModule,
    // Platform capability packages
    SettingsNestjsModule, // module config + admin-editable settings
    UserAuthModule,       // registers AuthNestjsModule with user config
    RbacModule,
    NotificationsModule,
    ActivityLogModule,
    ReminderEngineModule,
    // Domain modules
    CandidatesModule,
    OrdersModule,
    // Platform configuration modules (each capability owns its own module)
    SettingsModule,
    NotificationRulesModule,
    WorkflowDefinitionsModule,
  ],
})
export class AppModule {}
```

Each platform capability that needs CRUD configuration gets its own module under `modules/` (e.g., `modules/settings/`, `modules/notification-rules/`). There is no catch-all "admin" module — RBAC handles access control, and each module owns its own controllers, DTOs, and permissions.

### apps/web/ — React + Vite Frontend

```
apps/web/
  src/
    app/
      router.tsx            # merges all feature routes
      providers.tsx         # QueryClient, auth context, theme provider
      layout/
        AppLayout.tsx
        Sidebar.tsx
        Topbar.tsx
    main.tsx
  index.html
  vite.config.ts
  package.json
  tsconfig.json
```

`router.tsx` merges frontend module routes. Each module plugs itself in:

```ts
import { candidateRoutes } from "@modules/candidates/routes";
import { orderRoutes } from "@modules/orders/routes";

export const routes = [...candidateRoutes, ...orderRoutes];
```

### Worker — Background Job Processing

There is no separate `apps/worker/` application. The worker is the same `apps/api/` codebase running with different environment flags. `main.ts` conditionally bootstraps HTTP and/or queue consumers based on `API_ENABLED` and `WORKER_ENABLED`:

```ts
// apps/api/src/main.ts
const app = await NestFactory.create(AppModule);

if (API_ENABLED) {
  // Set up HTTP: global prefix, pipes, guards, Swagger, CORS
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ ... }));
  // ... other HTTP setup
  await app.listen(3000);
}

if (!API_ENABLED) {
  // Worker-only mode: no HTTP server, just keep process alive for queue consumers
  await app.init();
}
```

- **Dev/demo:** `API_ENABLED=true, WORKER_ENABLED=true` — one container handles both
- **Production:** Two containers from the same image. API: `API_ENABLED=true, WORKER_ENABLED=false`. Worker: `API_ENABLED=false, WORKER_ENABLED=true`.

The NestJS module graph loads in both modes (modules + packages). The actual cost difference is HTTP server setup (Swagger, pipes, port binding), which is skipped in worker-only mode.

The flow: domain event → side-effect handler enqueues a job → worker picks it up → executes with retries.

---

## 2. Modules Layer — Backend Domain Logic

Each module represents a real-world business entity. Each module is a standalone NestJS module.

### Module Structure

```
apps/api/src/modules/<module-name>/
  controllers/              # NestJS controllers (REST endpoints)
  services/                 # Business logic + repository (DB access)
  events/
    types.ts                # Event payload interfaces + event name constants
  dto/                      # Request/response validation (class-validator)
  permissions.ts            # Permission constants for this module
  <module-name>.module.ts   # NestJS module definition + event/permission registration
  schema.ts                 # Drizzle table definitions owned by this module (source of truth; centralized in packages/database/schema/)
  index.ts                  # Public API surface (only this gets imported externally)
```

### Module Rules

1. **A module owns its DB tables.** Its `services/` layer is the only code that queries those tables via Drizzle. No other module may query another module's tables directly. If `orders` needs client data, it calls `clientsService.getById()`, never `db.select().from(clients).where(...)`.

2. **A module exports a minimal public API via `index.ts`.** This is the only file other code may import from. Only export what consumer modules actually need: service classes, event types, event name constants, and enums. DTOs are internal to the controller layer and are never exported. Within exported service classes, only methods intended for cross-module use are `public` — everything else is `private` or `protected`. The public API is a deliberate, narrow contract. Note: this `index.ts` pattern applies to **backend modules and packages** as a cross-module API boundary. Frontend modules do NOT use barrel exports (see PROMPT-UI.md) — frontend code uses direct file imports to avoid circular dependencies and slow builds.

3. **Modules may import other modules' public APIs** for direct queries and commands. No circular dependencies — if `A → B` and `B → A`, extract shared logic into a third module or use events.

4. **Module services contain domain logic only.** Side effects (sending emails, logging activity, scheduling reminders) are never coded into domain services. After completing a domain operation, the service emits a domain event. Side-effect packages handle the rest.

5. **A module emits domain events** via the event bus after completing domain operations. Side-effect subscriptions are registered by the side-effect packages themselves. A module also registers its event metadata (name, description, payload schema) with the event registry in `onModuleInit` so platform UIs can discover available events.

6. **Domain-specific enums live in their own module**, not in a shared package. Example: `CandidateStatus` lives in `modules/candidates/`, not in `packages/common/`.

7. **Permissions are namespaced by module name.** Format: `module.action` (e.g., `candidates.create`, `candidates.read`) or `module.sub-resource.action` for modules with distinct sub-resources (e.g., `rbac.roles.manage`, `rbac.permissions.read`). Each module defines its own permission constants and registers them with `packages/rbac`'s permission registry in `onModuleInit`.

```ts
// apps/api/src/modules/candidates/permissions.ts
export const CANDIDATES_PERMISSIONS = {
  CREATE: 'candidates.create',
  READ: 'candidates.read',
  UPDATE: 'candidates.update',
  DELETE: 'candidates.delete',
} as const;
```

```ts
// apps/api/src/modules/candidates/candidates.module.ts
onModuleInit() {
  // Register events
  this.eventRegistry.register({ ... });

  // Register permissions
  this.permissionRegistry.register('candidates', [
    { action: 'create', description: 'Create candidates' },
    { action: 'read', description: 'View candidates' },
    { action: 'update', description: 'Edit candidates' },
    { action: 'delete', description: 'Delete candidates' },
  ]);
}
```

Controllers use the constants:

```ts
@RequirePermission(CANDIDATES_PERMISSIONS.CREATE)
@Post()
async create(@Body() dto: CreateCandidateDto) { ... }
```

The UI discovers all permissions via `GET /api/v1/permissions/registry` (served by the identity module's RBAC controllers), grouped by module, for assigning to roles.

### Domain vs Side-Effect Decision

When building any feature, always determine whether the logic is domain or side-effect:

| Question | If yes → |
|---|---|
| Is it core business logic specific to this entity? | Domain → lives in the module's service |
| Does it need data/action from another module? | Direct call → import that module's public API |
| Is it a reaction that the emitting module doesn't need to know about? | Side effect → emit event, handled by a package |
| Is it a generic capability (notifications, logging, search indexing)? | Side effect → extract to or use an existing package |
| Is it reusable across multiple modules? | Likely a package, not inline module code |

---

## 3. Event System

Events decouple domain logic from side effects. Domain modules emit events after completing operations. Side-effect packages subscribe and react independently.

### Core Rules

1. **The module that emits the event owns the event definition.**
2. **Events are for side effects, not for domain-to-domain communication.** If module A needs module B to do something and cares about the result, call B's public API directly.
3. **All domain events extend a base interface** so side-effect packages can process them generically.
4. **Event names are always exported constants**, never magic strings. Names are namespaced by module and use past tense (something happened, not a command to do something). Constant: `CANDIDATES_CANDIDATE_SUBMITTED`. Value: `"candidates.CandidateSubmitted"`. The dot-namespaced value enables `EventEmitter2` wildcard subscriptions per module (e.g., `"candidates.**"`).

### Base Event Interface

Defined in `packages/events/`. All domain events extend this so that side-effect packages (activity-log, notifications, etc.) can handle them without importing module-specific types.

```ts
// packages/events/types.ts
export interface DomainEvent {
  eventName: string;
  entityType: string;
  entityId: string;
  actorId: string;
  correlationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}
```

### Event Registry

`packages/events/` also provides an event registry service. Modules register their events as metadata in `onModuleInit` so that platform UIs (notification rule builder, workflow editor) can discover available events and their payload schemas at runtime.

```ts
// apps/api/src/modules/candidates/candidates.module.ts
onModuleInit() {
  this.eventRegistry.register({
    eventName: CANDIDATES_CANDIDATE_SUBMITTED,
    entityType: "candidate",
    description: "Fired when a candidate is submitted to an order",
    payloadSchema: {
      orderId: { type: "string", label: "Order ID" },
      submittedBy: { type: "string", label: "Submitted by (user ID)" },
    },
  });
}
```

The event registry is exposed as a read-only API endpoint. The controller for this lives in the module that owns the event system (e.g., `modules/events/controllers/event-registry.controller.ts`).

### Event Producer (Domain Module)

```ts
// apps/api/src/modules/candidates/events/types.ts
import type { DomainEvent } from "@packages/events";

export const CANDIDATES_CANDIDATE_SUBMITTED = "candidates.CandidateSubmitted" as const;

export interface CandidateSubmittedEvent extends DomainEvent {
  eventName: typeof CANDIDATES_CANDIDATE_SUBMITTED;
  entityType: "candidate";
  payload: {
    orderId: string;
    submittedBy: string;
  };
}
```

Exported via the module's public API:

```ts
// apps/api/src/modules/candidates/index.ts
export { CANDIDATES_CANDIDATE_SUBMITTED } from "./events/types";
export type { CandidateSubmittedEvent } from "./events/types";
```

The domain service emits the event **after** the core operation completes:

```ts
// apps/api/src/modules/candidates/services/candidatesService.ts
async submitCandidate(dto: SubmitCandidateDto, actorId: string) {
  // 1. Domain logic — direct call to another module if needed
  const order = await this.ordersService.getById(dto.orderId);
  if (!order) throw new NotFoundException("Order not found");

  // 2. Own domain operation
  const [candidate] = await this.database.db
    .update(candidates)
    .set({ status: "submitted" })
    .where(eq(candidates.id, dto.candidateId))
    .returning();

  // 3. Emit event — side-effect packages handle the rest
  this.eventEmitter.emit(CANDIDATES_CANDIDATE_SUBMITTED, {
    eventName: CANDIDATES_CANDIDATE_SUBMITTED,
    entityType: "candidate",
    entityId: candidate.id,
    actorId,
    correlationId,  // passed from the request context
    occurredAt: new Date().toISOString(),
    payload: { orderId: dto.orderId, submittedBy: actorId },
  });

  return candidate;
}
```

### Event Consumers (Side-Effect Packages)

Side-effect packages register their own subscriptions. They subscribe in their own module code, not in the emitting module or app module.

```ts
// packages/activity-log/activityLogListener.ts
// Subscribes to ALL domain events — fully generic, no module imports needed
@OnEvent("**")
async handleAnyEvent(event: DomainEvent) {
  await this.activityLogService.log({
    eventName: event.eventName,
    entityType: event.entityType,
    entityId: event.entityId,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
  });
}
```

```ts
// packages/notifications/notificationListener.ts
// Subscribes to ALL events, uses DB rules to decide what to enqueue
@OnEvent("**")
async handleAnyEvent(event: DomainEvent) {
  const rules = await this.rulesService.findByEventName(event.eventName);
  for (const rule of rules) {
    // Enqueue — don't send inline. Worker handles actual delivery with retries.
    await this.queueService.enqueue("notification.send", {
      ruleId: rule.id,
      templateId: rule.templateId,
      event,
    });
  }
}
```

### Event Handler Resilience

1. **Side-effect handlers must be idempotent.** Safe to retry without duplicate effects. Use unique event IDs or deduplication keys.
2. **Handler failure must never roll back the domain operation.** The candidate was submitted — that's a fact. If the email fails, the submission still stands.
3. **Handlers that talk to external systems (email, SMS, webhooks) must not do the work inline.** Instead, enqueue a job via `packages/queue`. The event handler's only job is to create the queue entry. `apps/worker` processes the actual unreliable I/O with retries and dead-letter handling.
4. **Lightweight handlers (DB writes like activity-log) can run inline** in the event handler. If they fail, log the error — don't crash the process.

```
Event emitted
  → activity-log handler → writes to DB inline (lightweight, reliable)
  → notifications handler → enqueues a job via packages/queue (unreliable I/O)
      → apps/worker picks up job → sends email with retries
```

### Dependency Direction for Events

- **Emitting module** → knows nothing about subscribers. Emits and moves on.
- **Side-effect packages** → subscribe generically using the base `DomainEvent` interface from `packages/events`. They do NOT import from app modules. They use DB-driven configuration (notification rules, reminder schedules) to decide how to react.


### Event Flow Example

A candidate is submitted to an order:

```
1. API call → candidates controller → calls candidatesService.submitCandidate()
2. candidatesService → calls ordersService.getById() (direct call — needs the result)
3. candidatesService → updates candidate status in DB (own domain operation)
4. candidatesService → emits CANDIDATES_CANDIDATE_SUBMITTED event
5. packages/activity-log picks it up → logs activity (generic, no domain knowledge)
6. packages/notifications picks it up → DB rules → enqueues job (generic, DB-configured)
7. packages/reminder-engine picks it up → schedules follow-up (generic, DB-configured)
```

Domain-to-domain communication used direct calls (step 2). Side effects used events (steps 5–7). The candidates module has no knowledge of who listens to its events.

---

## 4. Frontend Modules Layer — Frontend Domain Logic

Each frontend module owns everything it needs for the UI. Frontend modules map 1:1 to backend modules by name.

### Frontend Module Structure

```
apps/web/src/modules/<module-name>/
  api/                      # API calls using packages/api-client
  components/               # Module-specific React components
  hooks/                    # Module-specific hooks (TanStack Query wrappers)
  pages/                    # Route-level page containers
  routes.ts                 # Route definitions for this module
  types.ts                  # Frontend-specific types
```

### Frontend Module Rules

1. **A frontend module owns its pages, components, hooks, and API calls.** Nothing leaks outside.

2. **Pages are route-level containers. Components are reusable pieces.**

   ```
   pages/CandidateListPage.tsx       # route-level
   components/CandidateTable.tsx      # reusable within module
   components/CandidateForm.tsx
   ```

3. **Each frontend module defines its own routes:**

   ```ts
   // apps/web/src/modules/candidates/routes.ts
   export const candidateRoutes = [
     { path: "/candidates", element: <CandidateListPage /> },
     { path: "/candidates/:id", element: <CandidateProfilePage /> },
   ];
   ```

4. **API layer uses TanStack Query:**

   ```ts
   // apps/web/src/modules/candidates/api/candidateApi.ts
   import { api } from "@modules/lib/api";
   export const getCandidates = () => api.get("/candidates");
   ```

   ```ts
   // apps/web/src/modules/candidates/hooks/useCandidates.ts
   import { useQuery } from "@tanstack/react-query";
   import { getCandidates } from "../api/candidateApi";
   export const useCandidates = () =>
     useQuery({ queryKey: ["candidates"], queryFn: getCandidates });
   ```

5. **Frontend modules may import from:**
   - `@packages/*` — any shared package (ui, api-client, auth-ui, common, etc.)
   - **Never from backend modules.** The API is the boundary. Frontend defines its own types based on the API contract (e.g., `type CandidateStatus = "active" | "submitted" | "rejected"`).

6. **Cross-module reads are allowed for aggregate views.** A dashboard module may import hooks from other modules for read-only display. Dashboard never modifies other modules' state.

7. **Configuration pages** for platform capabilities live in their own frontend modules (e.g., `modules/settings/`, `modules/notification-rules/`). Pages are thin wrappers that fetch data via API endpoints and compose components from platform UI packages (`@packages/notifications-ui`, `@packages/workflow-engine-ui`, etc.).

---

## 5. Packages Layer — Reusable, Domain-Agnostic

Packages have ZERO knowledge of business domains. They never reference "candidate", "order", or any domain concept. They are fully reusable in any application.

### Package Categories

**Infrastructure (backend):** Low-level plumbing.

Examples: database (Drizzle ORM + pg Pool + schema definitions), events (in-memory event bus), queue (durable async jobs via BullMQ, including repeatable/cron jobs).

**Platform Capabilities (backend, invoked directly):** Cross-cutting engines that domain services call directly via their public API. They provide capabilities that modules need during their domain operations. CRUD endpoints for managing their configuration (roles, workflow definitions, etc.) live in their own modules (e.g., `modules/settings/`, `modules/workflow-definitions/`).

Examples: auth + auth-nestjs (config-driven authentication — see PROMPT-AUTH.md), rbac (roles + permissions + guards), workflow-engine (DB-driven state machine), files (storage abstraction), search (search abstraction).

Usage example — RBAC in domain modules:

```ts
// apps/api/src/modules/candidates/controllers/candidatesController.ts
@UseGuards(RbacGuard)
@RequirePermission('candidates.create')
@Post()
async create(@Body() dto: CreateCandidateDto) { ... }
```

`packages/rbac-nestjs` exports guards and decorators. `RbacNestjsModule` is registered per entity type (like auth), making guards available globally. Management of roles, permissions, and user-role assignments is handled by RBAC controllers within the relevant module (e.g., `apps/api/src/modules/users/rbac/`), which delegate to `rbacService`.

**Side-Effect Packages (backend, event-driven):** Cross-cutting engines that subscribe to domain events and react generically. No module calls them directly — they listen and act independently. They contain no domain knowledge — all behavior is configured via DB rules, not hardcoded `if/else` chains. CRUD endpoints for configuring these packages live in their own modules (e.g., `modules/notification-rules/`, `modules/reminder-rules/`).

Examples: notifications (DB-driven templates + delivery), activity-log (event-driven feed), reminder-engine (scheduled side-effects).

These packages self-register their event subscriptions using `@OnEvent()` decorators. They process domain events using the base `DomainEvent` interface from `packages/events` — they never import from app modules.

**Platform UI Packages (frontend):** Reusable React components for configuring platform capabilities. These are props-driven building blocks — no API calls, no routing, no data-fetching hooks. The consuming frontend module (e.g., `modules/settings/`, `modules/notification-rules/`) owns data fetching and wires these components into pages.

Examples: auth-ui (login form, register form, password reset, session expired modal), notifications-ui (rule builder, template editor, channel selector), workflow-engine-ui (state machine editor, transition builder), reminder-engine-ui (schedule builder).

A platform capability only gets a `-ui` package when it has a complex configuration surface. Simple packages (activity-log, search) may not need one.

**Frontend:** Shared UI and client utilities.

Examples: ui (design system components — Button, Modal, Table, etc.), api-client (typed HTTP client with auth interceptors).

**Shared (both):** Pure types and constants.

Example: common — contains ONLY truly generic types (`PaginatedResponse<T>`, `ApiResponse<T>`, `BaseEntity`, `DEFAULT_PAGE_SIZE`). Domain-specific types do NOT go here.

### Package Design Rules

1. **No domain knowledge.** A package never imports from app modules.
2. **Swappable implementations.** Infrastructure packages define interfaces. The in-memory event bus can be swapped to Redis/NATS. Local file storage can be swapped to S3. Modules never depend on the implementation, only the interface.
3. **Self-contained.** Each package has its own `package.json` and dependencies.
4. **Platform packages use DB for configuration, not code.** Notification rules, workflow definitions, RBAC permissions — all stored in DB. No hardcoded `if/else` chains.

---

## 6. Database

### Drizzle Schema Organization

All Drizzle table definitions live in `packages/database/schema/`, organized by module. Each module conceptually "owns" its schema file. Since Drizzle schemas are TypeScript files with import dependencies (unlike Prisma's text-based schemas), they must be centralized in the database package so that all packages can import table definitions.

```
packages/database/
  schema/
    identity.ts                         # identities, passwordTokens, roles, permissions, rolePermissions, identityRoles
    users.ts                            # users (imports identities for FK)
    settings.ts                         # settings
    relations.ts                        # all Drizzle relations (for relational query API)
    index.ts                            # barrel export
  drizzle/                              # generated migration files (committed to git)
  drizzle.config.ts                     # drizzle-kit configuration
  index.ts                              # DatabaseService + DatabaseModule + re-exports
```

### Schema & Migration Commands

```json
// packages/database/package.json (relevant entries)
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

- `pnpm db:generate` → generates a new migration SQL file from schema changes.
- `pnpm db:migrate` → applies pending migrations to the database.
- `pnpm db:push` → pushes schema directly to the database (dev only, no migration file).
- Adding a new table → create/update the schema file in `packages/database/schema/`, then `pnpm db:generate`.

### DB Access Rules

- Each module's `services/` layer is a repository that only queries its own tables. Each package's service layer only queries its own tables.
- Cross-module data access goes through the other module's public service API, never direct Drizzle queries.
- Foreign key columns across modules are allowed (they're data integrity constraints). The model that holds the FK column owns it (e.g., `candidates.orderId` is owned by the candidates module).
- Cross-module joins in Drizzle are NOT allowed. Never join another module's table in your query. Fetch the related data via the other module's service instead.
- Shared DB, no schema-per-module isolation. Boundaries are enforced at the code layer.

---

## 7. Monorepo Configuration

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {}
  }
}
```

### tsconfig.base.json

Shared TypeScript config at root. All packages, modules, features, and apps extend from it. Path aliases:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@packages/*": ["./packages/*"]
    }
  }
}
```

---

## 8. Code Quality Rules

- All code in TypeScript strict mode.
- Every package, module, and feature has its own `package.json` with correct dependencies.
- No circular dependencies between modules.
- No domain logic in packages. No side effects in domain services.
- No direct DB access outside a module's own service layer. No cross-module joins in Drizzle queries.
- Event names are namespaced, past-tense, exported constants — never magic strings.
- Side-effect event handlers must be idempotent. Unreliable I/O is enqueued via `packages/queue`, never done inline.
- Every module's public API is exported via `index.ts` — kept intentionally narrow.
- Frontend components use `@packages/ui` for shared UI. Platform UI packages (`*-ui`) are props-driven — no data fetching.
- API calls always go through `@packages/api-client`, never raw fetch/axios in features.
- Side-effect package behavior is configured via DB rules, not hardcoded logic. Domain module config is defined within each module.
