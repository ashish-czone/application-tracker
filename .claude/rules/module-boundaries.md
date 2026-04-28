## Module Boundaries

1. **A module owns its DB tables.** Only its `services/` layer queries those tables. No other module may query them directly — call the owning module's service instead.

2. **Cross-module joins are NOT allowed.** Never join another module's table in a Drizzle query. Fetch via the other module's service. **Exception:** joins to `directory.companies`, `directory.people`, and `users` are allowed from any module — these are platform-tier identity registries with no domain logic, intentionally shared as the canonical FK target. Writes still go through `CompaniesService` / `PeopleService` / `UsersService`; only reads may join directly.

3. **Foreign key columns across modules are allowed** (data integrity). The module holding the FK column owns it.

4. **Public API via `index.ts` only.** Other code may only import from a module's `index.ts`. Export only what consumers need: service classes, event types, event name constants, enums. DTOs are internal. Within services, only cross-module methods are `public`.

5. **No domain logic in packages.** Packages (`packages/*`) have ZERO knowledge of business entities. Never reference "candidate", "order", etc.

6. **Domain enums live in their module**, not in shared packages. Example: `CandidateStatus` → `modules/candidates/`.

7. **Permissions namespaced by module:** `module.action` (e.g., `candidates.create`). Registered with permission registry in `onModuleInit`.

8. **Side effects via events, not inline code.** After domain operations, emit events. Side-effect packages handle the rest independently.
