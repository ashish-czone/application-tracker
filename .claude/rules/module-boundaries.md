## Module Boundaries

1. **A module owns its DB tables for writes.** Inserts, updates, and deletes on a module's tables go through that module's service layer. Reads via direct query are governed by bullet 2 — they are allowed across some boundaries and forbidden across others.

2. **Cross-DOMAIN joins are NOT allowed.** A query rooted in `domains/X` MUST NOT join a table owned by `domains/Y`. Cross-domain reads go through the other domain's service. **Allowed reads:**
   - **Intra-domain sibling joins** — modules within the same domain (e.g. `domains/compliance/api/compliance-filings/` joining `domains/compliance/api/laws/`) MAY query each other's tables directly. The whole domain ships as one unit; intra-domain coupling lifts with it.
   - **Domain → addon / platform-package joins** — a domain MAY join tables exported by any package listed in its `package.json` deps (e.g. compliance joining `@packages/org-units` for `org_units`, or a domain joining `users` from `@packages/database`). Same transitive dependency that already exists at the service-call layer.
   - **Shared identity tables** — `clients`, `client_contacts`, `users`, and `org_units` are joinable from any module per [Shared Identity Tables](#shared-identity-tables) below.

   **Caller responsibilities on every join:**
   - Apply `withScope(joinedTable, …)` for soft-delete + tenant on each joined table per `.claude/rules/data-scoping.md`. These are structural; they apply per-table regardless of the driver.
   - Actor-scope on joined tables is **NOT** re-applied — the driver of the query is the authorization root. See `.claude/rules/data-access-scope.md` § *Joined tables: the driver is the authorization root*.
   - Project columns deliberately. Don't `SELECT joinedTable.*`; pick the display columns the response actually needs. Sensitive columns (SSN, salary, password hashes) need column-level care regardless of join semantics.

3. **Foreign key columns across modules are allowed** (data integrity). The module holding the FK column owns it.

4. **Public API via `index.ts` only.** Other code may only import service classes, public types, event-name constants, and enums from a module's `index.ts`. DTOs are internal. Within services, only cross-module methods are `public`. **Exception:** cross-module *schema* joins import directly from `<other-module>/<other-module>.schema` — Drizzle table references are stable data constants; the barrel rule covers behavior (services, modules), not table definitions.

5. **No domain logic in packages.** Packages (`packages/*`) have ZERO knowledge of business entities. Never reference "candidate", "order", etc.

6. **Domain enums live in their module**, not in shared packages. Example: `CandidateStatus` → `modules/candidates/`.

7. **Permissions namespaced by module:** `module.action` (e.g., `candidates.create`). Registered with permission registry in `onModuleInit`.

8. **Side effects via events, not inline code.** After domain operations, emit events. Side-effect packages handle the rest independently.

## Shared Identity Tables

Four platform-tier registries — `clients`, `client_contacts`, `users`, and `org_units` — follow a relaxed boundary model. They are joinable from any module, and (for the first three) extensible by domains via prefixed columns rather than by wrapping in per-domain extension tables. This is the CRM-style pattern (Salesforce, HubSpot, Dynamics, Dataverse): one shared identity object, namespaced per-domain extensions, permission scoping by prefix.

**Why:** every domain in this codebase (recruit, compliance, agency, …) commonly attaches data to the same clients and contact people, and assigns work to the same users and teams. The same client is often a recruit client, a compliance subject, and an agency lead. Forcing each domain to wrap the shared row in its own extension table pays ergonomic costs (extra joins, lookup resolvers, dual-insert transactions) for an isolation guarantee the use case doesn't need. The shared-identity pattern is what every mature multi-module business platform uses.

> Note: the JS-side names are `clients` / `client_contacts` (exported as `baseClientColumns` / `baseClientContactColumns` from `@packages/directory`). Underlying DB tables are still named `companies` / `people` until a coordinated DB-rename migration ships in a follow-up PR. Code never needs to reference the DB names directly.

> **`org_units` differs from the other three.** It is a hierarchy registry (units, parents, levels), not a per-row identity record. The join allowance applies to it identically — any module may LEFT JOIN `org_units` for display labels or filter on its columns — but the **prefix-extension and permission-by-prefix mechanics below do NOT apply**. Writes go through `OrgUnitService`; the schema is owned end-to-end by `@packages/org-units`. Domains needing org-unit-scoped state attach it to their own tables (e.g. `complianceFilings.assigneeTeamId`), not to `org_units` itself.

### Schema extension by prefix

- A domain may add columns to `clients` / `client_contacts` / `users` via the domain's own migration. Columns MUST be prefixed with the domain slug followed by an underscore — e.g. `recruit_segment`, `recruit_assignedRecruiterId`, `compliance_registrationId`, `agency_tier`.
- Drizzle composition is via column spread: `directory` exports `baseClientColumns` / `baseClientContactColumns`; each domain re-declares an extended `pgTable` reference with its prefixed columns spread in. Each domain's typed projection includes only base columns + its own prefix columns. Directory's services see only base columns.
- Each domain owns the migration that adds (and later alters) its own prefixed columns. Hand-write the ALTERs, or scope `drizzle-kit generate` per package so it diffs only that package's columns. Drizzle does not auto-merge cross-package extensions.

### Ownership and writes

- A domain owns reads and writes for its own prefixed columns. Directory's services (`ClientsService`, `ClientContactsService`, `UsersService`) write only base columns. Recruit's services write `recruit_*`; compliance writes `compliance_*`; etc.
- The **app layer** (which composes domains) may write across prefixes in one statement. That's the explicit lever for cross-domain transactional creates — a client that becomes both a recruit and compliance client is one INSERT, not two service calls in a transaction.
- Cross-domain writes (one domain writing another domain's prefixed columns) are NOT allowed. Use the owning domain's service.

### Permission scoping by prefix

- Read/write permissions are scoped by **prefix**, not per-field. `recruit.clients.read` gates every `recruit_*` column on `clients`. `compliance.clients.read` gates `compliance_*`. No field-level RBAC primitive is needed.
- Each domain's typed projection is the in-process chokepoint: directory's `ClientsService.findById` returns base columns only; recruit's services return base + `recruit_*`. The type system enforces visibility for callers that go through services.
- For wide cross-domain views (admin screens, unified search), one read-projection helper at the API/composition layer takes the wide row + caller permission set and strips columns whose prefix the caller cannot read.
- Action granularity within a prefix uses the existing `module.action` permission scheme: `recruit.clients.write` for general writes, `recruit.clients.assign` for the narrower right to set assignment columns, etc.
- If intra-domain read tiers are needed (e.g., sensitive notes within recruit), use a **sub-prefix**: `recruit_internal_*` gated by `recruit.clients.readInternal`. Reach for this only when the case actually exists.

### When NOT to extend the shared table

The prefix pattern doesn't fit every relationship. Keep a separate domain table when:

- The relationship is **many-to-many** within the same domain — e.g., a person who is contact at multiple recruit clients. Columns can't model 1:N.
- Heavy domain-specific child tables need a **structural FK anchor** that "is-a-domain-client" guarantees. The prefix-on-clients approach treats "is a recruit client" as a non-null column or boolean — a convention guarantee, not a structural one. If you need the database to refuse `recruit_client_jobs` rows pointing at non-clients, keep an explicit `recruit_clients` row as the FK target.

In practice, most fields fit the prefix pattern; the exceptions above are real but uncommon.
