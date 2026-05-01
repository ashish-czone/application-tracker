## Module Architecture

How an entity-bearing module is built. Covers two things:

1. **File shape inside the module folder** (consistent across the codebase)
2. **How concerns are wired** — workflow, permissions, CRUD service, list view — using the camp-B helpers (`defineWorkflow`, `crudPermissionManifests`, `BaseCrudService`, `defineListLayout`)

These rules are project conventions, not framework requirements. They exist because the codebase has migrated away from a single bundled `defineEntity({...})` declaration that handled every concern, toward explicit per-concern declarations that compose. A new module that follows these rules slots into the established pattern; one that doesn't will fight the codebase.

### Reference modules

When in doubt, copy the shape:

- **`domains/compliance/api/rules/`** — workflow + permissions on camp-B path; substantial custom service
- **`domains/compliance/api/organizations/`** — `BaseCrudService` (singleton with override invariants)
- **`domains/compliance/api/client-contacts/`** — `BaseCrudService` (regular collection with custom domain methods)
- **`domains/compliance/api/compliance-filings/`** — multi-service split (4 services), scope-aware permissions, complex workflow

### File shape — what every entity module folder looks like

```
<module>/
├── __tests__/                       # All unit tests live here
│   ├── <module>.<concern>.test.ts
│   └── ...
├── index.ts                         # Public API barrel (the only way out)
├── <module>.schema.ts               # Drizzle table definition
├── <module>.entity.ts               # defineEntity() — schema/slug/CRUD wiring
├── <module>.workflow.ts             # OPTIONAL: defineWorkflow()
├── <module>.permissions.ts          # crudPermissionManifests() + extras
├── <module>.dto.ts                  # Zod schemas (request bodies + URL queries)
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.module.ts               # NestModule wiring
└── <module>.seeds.ts                # OPTIONAL: demo seeds
```

### Hard rules — file shape

1. **Folder name = file prefix.** Folder `rules/` → every file is `rules.*.ts`. Folder `compliance-filings/` → every file is `compliance-filings.*.ts`. **No redundant prefix** — files inside `domains/compliance/api/rules/` must NOT be named `compliance-rules.*.ts`. The folder path already encodes the namespace.
2. **Schema co-located with module.** Drizzle table lives in `<module>.schema.ts` next to the service that owns it. If `schema/index.ts` (drizzle-kit barrel) needs to know about the table, it re-exports from the module's schema file — never the other way around.
3. **`index.ts` is the only public way out.** Cross-module callers import from `@module-folder` (the barrel), not from individual files inside the folder. The barrel exports: the NestModule, public service classes, public types, error classes that callers may catch. Internals (configs, DTOs, schema) stay unexported. **Exception:** cross-module schema joins import directly from `<other-module>/<other-module>.schema` — schemas are stable constants, the barrel rule applies to behaviour (services, modules), not data.
4. **Tests in `__tests__/`.** Source files at the module root, tests one folder down. Drop `.unit.` from test file names — `<module>.<concern>.test.ts`, not `.unit.test.ts`.
5. **No subfolders for seeds, dto, helpers, etc.** A flat module folder is the goal. If a concern grows beyond a single file, it's either a sub-module (its own folder) or it stays inlined as private code in the file that owns it. Multiple seed files use period-separator qualifiers: `<module>.<demo|system>.seeds.ts`.
6. **Period-separator for compound names.** `compliance-filings.assignee-cleanup.service.ts` — the folder prefix joins with a period; hyphens within a concern name are preserved. Not `compliance-filings-assignee-cleanup.service.ts` (visually parses as one big name).
7. **DTOs validate; helpers translate.** Pure URL parsing → Zod schema in `<module>.dto.ts`. Domain semantics (bucket expansion, engine-filter shape) → a `<module>.filters.ts` helper. **Don't put domain logic in Zod transforms.** Don't write hand-rolled URL parsers when Zod handles it.

### Service file rules

8. **One service per module — UNLESS** the additional service is *exported* (= part of the module's public API) AND has *materially different deps* from the main CRUD service. Internal helpers stay private (file or method). `compliance-filings/` is the canonical example — 4 services (`Service`, `Lookup`, `Cancellation`, `AssigneeCleanup`) all exported, all consumed by different external modules, each with distinct constructor deps. By contrast, a 200-line "helper service" used only inside the same module should be private code, not a separate file.
9. **One DTO style per module: Zod.** No mixing class-validator + Zod. Controllers do `Schema.parse(body)` per endpoint, not relying on a global ValidationPipe.

### How concerns get wired — camp-B helpers

Each concern has its own helper. `defineEntity` is the substrate; the helpers extract specific concerns out of it.

#### Workflows — `defineWorkflow()` + `WorkflowsModule.forFeature()`

```ts
// rules.workflow.ts
import { defineWorkflow } from '@packages/workflows';

export const RULES_WORKFLOW = defineWorkflow({
  slug: 'compliance-rule-status',
  entityType: 'compliance-rules',
  fieldName: 'status',
  initialState: 'draft',
  states: [...],
  transitions: [...],
});

// rules.module.ts
@Module({
  imports: [
    EntityEngineModule.forEntity(RULES_ENTITY),
    WorkflowsModule.forFeature(RULES_WORKFLOW),
    ...
  ],
})
```

In `<module>.entity.ts`, the workflow field becomes `type: 'text'` — the engine doesn't see it as a workflow field anymore. Runtime workflow resolution flows through `WorkflowRegistryService.getByEntityField(entityType, fieldName)`, independent of the static field-type metadata.

**V1 idempotency**: `forFeature` registers the def at module init. If the slug already exists in the registry, it's a no-op for that boot. Re-running with updated states/transitions does NOT reconcile — admins edit via the workflows UI; operators apply SQL migrations for renames.

**Don't use** `defineWorkflow` for workflows that need a runtime `discriminator.resolve()` callback (entity-engine extension dependency). Those stay in `defineEntity({ fields.X.workflow })` for now. `recruit/applications` is the canonical exception.

#### Permissions — `crudPermissionManifests()` + `RbacIntegrationModule.forFeature()`

```ts
// rules.permissions.ts
import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

export const RULES_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'compliance-rules', entityName: 'rule' }),
  {
    slug: 'compliance-rules.deprecate',
    module: 'compliance-rules',
    action: 'deprecate',
    label: 'Deprecate rules',
    description: '...',
    supportedScopes: ['any'],
  },
];

// rules.entity.ts
export const RULES_ENTITY = defineEntity({
  ...,
  // Permissions live in rules.permissions.ts; opt out of the engine's auto-registration.
  skipAutoRegistration: { permissions: true },
});

// rules.module.ts
@Module({
  imports: [
    EntityEngineModule.forEntity(RULES_ENTITY),
    RbacIntegrationModule.forFeature({ manifests: RULES_PERMISSION_MANIFESTS }),
    ...
  ],
})
```

**Hard rule**: when `skipAutoRegistration: { permissions: true }` is set on an entity config, the module MUST register permissions externally via `RbacIntegrationModule.forFeature`. Otherwise no perms are registered for the slug — runtime permission checks will fail silently in tests but break grants in production.

**For entities with `dataAccess.scopes`** (compliance-filings is the example), the auto-derivation produces non-default `supportedScopes`. When migrating these to camp-B, hand-specify the scope array as a const and pass it to `crudPermissionManifests({ supportedScopes })` plus inline-extras. There's no runtime cross-check — drift is the cost of explicit declaration. See `compliance-filings.permissions.ts` for the canonical example.

**`extraPermissions` block** in `defineEntity` should be empty after migration — extras live in the `*.permissions.ts` file alongside the CRUD manifests.

#### Service — `BaseCrudService(table, options)`

```ts
@Injectable()
export class OrganizationsService extends BaseCrudService(organizations, {
  slug: 'organizations',
  events: {
    created: 'organizations.Created',
    updated: 'organizations.Updated',
    deleted: 'organizations.Deleted',
  },
}) {
  constructor(database: DatabaseService, events: DomainEventEmitter, appLogger: AppLoggerService) {
    super(database, events, appLogger);
  }

  // Override for custom invariant
  async create(input: CreateOrganizationDto, actorId: string) {
    const [{ count: rowCount }] = await this.database.db.select({ count: count() }).from(organizations);
    if (rowCount > 0) throw new BadRequestException('singleton');
    return super.create(input, actorId);
  }

  // Override for hard-block
  async softDelete(_id: string, _actorId: string, _accessCtx?: DataAccessContext): Promise<never> {
    throw new BadRequestException('cannot delete');
  }
}
```

**When to use** `BaseCrudService`:
- Entity service is mostly CRUD with a few overrides for invariants
- Custom methods only need `DatabaseService` + `DomainEventEmitter` (both inherited)
- No actor-scope predicates (the base accepts `accessCtx` but doesn't apply it yet)

**When to STAY hand-rolled**:
- Service is dominated by custom domain logic (rules' deprecate cascade, clients' dormancy guards, compliance-filings' 5-service split)
- Multiple services for one entity, each with distinct deps (compliance-filings)
- Need actor-scope predicates applied per-method (manually call `DataAccessScopeService.buildPredicate`)

**Don't:** force-fit a complex service into `BaseCrudService` by overriding most methods. The helper fits when CRUD is the main thing; not when CRUD is incidental.

**Controller's `findOne`** should call `findOneOrFail`, not `findOne` — the base's `findOne` returns null on miss; the controller wants 404.

#### Layout — `defineListLayout()` + `<EntityListView>` (frontend)

```ts
// rules.list-layout.ts (frontend, in compliance/ui/...)
import { defineListLayout } from '@packages/entity-views-ui';
import type { ComplianceRule } from '@domains/compliance-contract';

export const RULES_LIST_LAYOUT = defineListLayout<ComplianceRule>({
  entity: 'compliance-rules',
  defaultSort: { field: 'code', order: 'asc' },
  columns: [
    { field: 'code',   label: 'Code',   cell: 'text',     searchable: true, sortable: true, width: 120 },
    { field: 'lawId',  label: 'Law',    cell: 'lookup',   lookup: { entity: 'laws', labelField: 'name' } },
    { field: 'status', label: 'Status', cell: 'workflow', workflowSlug: 'compliance-rule-status' },
  ],
});

// RulesListPage.tsx
<EntityListView layout={RULES_LIST_LAYOUT} useList={useRulesList} />
```

**Currently has zero consumers in compliance** — every compliance list page is bespoke. Use `EntityListView` for new entities that don't need page-specific UX (custom drawers, tab filters, etc.). For entities that do, build the page directly with `<DataGrid>` from `@packages/ui` — the layout config is overhead without payoff.

**`<EntityListViewProvider>`** must be mounted near the app root with `apiFn` and (optionally) a custom cell renderer registry. Required because cell renderers are name-resolved (`cell: 'workflow'` is a string) — the provider holds the registry.

### What still belongs in `defineEntity`

After camp-B extraction, the following stays bundled in the entity config:

- `table` (Drizzle reference)
- `slug` (URL + permission namespace)
- `timestamps`, `subtitleField`, `nameField`, etc.
- `fields.X.{type, label, required, listVisible, listOrder, searchable, sortable, isLabel}` — UI metadata + validation hints
- `fields.X.{type: 'lookup', entity, lookupLabelField, lookupSearchFields}` — lookup hydration
- `relationships`, `sections`, `defaultSort`
- `dataAccess.{anchors, scopes}` — actor-scope predicates
- `computedColumns`
- `features` (notes/attachments addon hooks)
- `hierarchy`, `orderable`, `adminConfigurable`, `customFields`

`defineEntity` is still load-bearing — it owns CRUD wiring, lookup hydration, layout metadata, and addon feature integration. The camp-B work has not eliminated it; it has narrowed its responsibilities.

### Imports cheat-sheet

| Helper | Package |
|---|---|
| `defineEntity`, `BaseCrudService` | `@packages/entity-engine` |
| `defineWorkflow`, `WorkflowsModule.forFeature` | `@packages/workflows` |
| `crudPermissionManifests`, `RbacIntegrationModule.forFeature` | `@packages/rbac` |
| `defineListLayout`, `EntityListView`, `EntityListViewProvider` | `@packages/entity-views-ui` |

### When NOT to follow these rules

- **One-off utility modules** that aren't entity-bearing — they don't need a `<module>.entity.ts`, `<module>.permissions.ts`, etc. The rules are for entity-bearing modules; pure utility modules can be flat (`.module.ts` + `.service.ts` + tests).
- **`@packages/*` foundation code** — different conventions (each package owns its own internal structure). The rules apply to `domains/*/api/<module>/` and `apps/*/src/modules/<module>/`.
- **External integrators** (`@packages/platform/app-shell`, `@packages/platform/testing`) — these wire everything together at the app/test layer; they don't follow per-module patterns.
