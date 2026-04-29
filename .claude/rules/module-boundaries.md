## Module Boundaries

1. **A module owns its DB tables.** Only its `services/` layer queries those tables. No other module may query them directly — call the owning module's service instead. **Exception:** the shared identity tables `directory.companies`, `directory.people`, and `users` follow the relaxed pattern in [Shared Identity Tables](#shared-identity-tables) below.

2. **Cross-module joins are NOT allowed.** Never join another module's table in a Drizzle query. Fetch via the other module's service. **Exception:** the shared identity tables (`directory.companies`, `directory.people`, `users`) are joinable from any module. Reads via direct join are allowed. Writes follow the prefix-ownership rule in [Shared Identity Tables](#shared-identity-tables) — base columns through the owning service, prefixed columns through the prefix-owning domain's service.

3. **Foreign key columns across modules are allowed** (data integrity). The module holding the FK column owns it.

4. **Public API via `index.ts` only.** Other code may only import from a module's `index.ts`. Export only what consumers need: service classes, event types, event name constants, enums. DTOs are internal. Within services, only cross-module methods are `public`.

5. **No domain logic in packages.** Packages (`packages/*`) have ZERO knowledge of business entities. Never reference "candidate", "order", etc.

6. **Domain enums live in their module**, not in shared packages. Example: `CandidateStatus` → `modules/candidates/`.

7. **Permissions namespaced by module:** `module.action` (e.g., `candidates.create`). Registered with permission registry in `onModuleInit`.

8. **Side effects via events, not inline code.** After domain operations, emit events. Side-effect packages handle the rest independently.

## Shared Identity Tables

The platform-tier identity registries `directory.companies`, `directory.people`, and `users` follow a relaxed boundary model. They are designed to be **extended** by domains rather than wrapped by per-domain extension tables. This is the CRM-style pattern (Salesforce, HubSpot, Dynamics, Dataverse): one shared identity object, namespaced per-domain extensions, permission scoping by prefix.

**Why:** every domain in this codebase (recruit, compliance, agency, …) commonly attaches data to the same companies and people. The same company is often a recruit client, a compliance subject, and an agency lead. Forcing each domain to wrap the shared row in its own extension table pays ergonomic costs (extra joins, lookup resolvers, dual-insert transactions) for an isolation guarantee the use case doesn't need. The shared-identity pattern is what every mature multi-module business platform uses.

### Schema extension by prefix

- A domain may add columns to `companies` / `people` / `users` via the domain's own migration. Columns MUST be prefixed with the domain slug followed by an underscore — e.g. `recruit_segment`, `recruit_assignedRecruiterId`, `compliance_registrationId`, `agency_tier`.
- Drizzle composition is via column spread: `directory` exports `baseCompanyColumns` / `basePeopleColumns`; each domain re-declares an extended `pgTable` reference with its prefixed columns spread in. Each domain's typed projection includes only base columns + its own prefix columns. Directory's services see only base columns.
- Each domain owns the migration that adds (and later alters) its own prefixed columns. Hand-write the ALTERs, or scope `drizzle-kit generate` per package so it diffs only that package's columns. Drizzle does not auto-merge cross-package extensions.

### Ownership and writes

- A domain owns reads and writes for its own prefixed columns. Directory's services (`CompaniesService`, `PeopleService`, `UsersService`) write only base columns. Recruit's services write `recruit_*`; compliance writes `compliance_*`; etc.
- The **app layer** (which composes domains) may write across prefixes in one statement. That's the explicit lever for cross-domain transactional creates — a company that becomes both a recruit and compliance client is one INSERT, not two service calls in a transaction.
- Cross-domain writes (one domain writing another domain's prefixed columns) are NOT allowed. Use the owning domain's service.

### Permission scoping by prefix

- Read/write permissions are scoped by **prefix**, not per-field. `recruit.companies.read` gates every `recruit_*` column on `companies`. `compliance.companies.read` gates `compliance_*`. No field-level RBAC primitive is needed.
- Each domain's typed projection is the in-process chokepoint: directory's `CompaniesService.findById` returns base columns only; recruit's services return base + `recruit_*`. The type system enforces visibility for callers that go through services.
- For wide cross-domain views (admin screens, unified search), one read-projection helper at the API/composition layer takes the wide row + caller permission set and strips columns whose prefix the caller cannot read.
- Action granularity within a prefix uses the existing `module.action` permission scheme: `recruit.companies.write` for general writes, `recruit.companies.assign` for the narrower right to set assignment columns, etc.
- If intra-domain read tiers are needed (e.g., sensitive notes within recruit), use a **sub-prefix**: `recruit_internal_*` gated by `recruit.companies.readInternal`. Reach for this only when the case actually exists.

### When NOT to extend the shared table

The prefix pattern doesn't fit every relationship. Keep a separate domain table when:

- The relationship is **many-to-many** within the same domain — e.g., a person who is contact at multiple recruit clients. Columns can't model 1:N.
- Heavy domain-specific child tables need a **structural FK anchor** that "is-a-domain-client" guarantees. The prefix-on-companies approach treats "is a recruit client" as a non-null column or boolean — a convention guarantee, not a structural one. If you need the database to refuse `recruit_client_jobs` rows pointing at non-clients, keep an explicit `recruit_clients` row as the FK target.

In practice, most fields fit the prefix pattern; the exceptions above are real but uncommon.
