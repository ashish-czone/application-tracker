import {
  cleanDatabase,
  createTestApp,
  type TestAppContext,
} from '@packages/platform-testing';
import { workflowsAddon, WorkflowRegistryService } from '@packages/workflows';
import { WorkflowsEntityEngineModule } from '@packages/workflows-entity-engine';
import {
  EntityRegistryService,
  FieldDefinitionService,
  LAYOUT_EXTENSION,
  WORKFLOW_EXTENSION,
  seedEntityFields,
  seedWorkflows,
  type EntityConfig,
  type LayoutExtension,
} from '@packages/entity-engine';
import { projectsBackend } from '../../index';

/**
 * Boots a NestJS HTTP test app with the projects domain wired up against
 * real Postgres. Mirrors the shell composition `apps/agency` uses at
 * runtime — same EntityEngineModule, WorkflowsModule, AuditModule, etc. —
 * so domain code resolves the same DI graph in tests as in production.
 *
 * Projects has no extra modules to wire (no org-units, no hierarchy, no
 * custom strategies) — workflows is the only addon required, because
 * every entity config uses workflow status fields.
 */
export async function createProjectsTestApp(): Promise<TestAppContext> {
  const ctx = await createTestApp({
    domains: [projectsBackend],
    addons: [workflowsAddon],
    extraImports: [WorkflowsEntityEngineModule],
  });

  await seedAllEntityDefinitions(ctx);
  return ctx;
}

/**
 * Writes field definitions, picklist options, layouts, AND workflow rows for
 * every registered entity. All four projects entities have
 * `adminConfigurable: true`, which means `FieldDefinitionService` reads its
 * field meta from the `field_definitions` table — not the in-memory registry.
 * Without this seeding step, the engine reports every payload key as
 * `'Unknown field'` and POST/PATCH return 400.
 *
 * Picks up the layout extension when `entity-layout` is loaded, otherwise
 * passes null (the layout writes are optional).
 */
async function seedAllEntityDefinitions(ctx: TestAppContext): Promise<void> {
  const registry = ctx.module.get(EntityRegistryService);
  const fieldDefService = ctx.module.get(FieldDefinitionService);
  const workflowExt = ctx.module.get(WORKFLOW_EXTENSION);
  const layoutExt = ctx.module.get<LayoutExtension | null>(LAYOUT_EXTENSION, { strict: false });

  // Reload BEFORE seeding: the cache still holds stale field-definition rows
  // from the previous test (or bootstrap). seedEntityFields' "already seeded?"
  // check consults `findByEntityAndKey`, which serves from cache — without a
  // pre-reload it would treat fields as already existing and try to attach
  // picklist options under stale field IDs that the truncated DB no longer
  // has, producing FK violations.
  await fieldDefService.reloadCache();

  for (const entry of registry.getAll() as EntityConfig[]) {
    if (entry.adminConfigurable) {
      await seedEntityFields(entry, fieldDefService, layoutExt ?? null);
    }
    await seedWorkflows(entry, workflowExt);
  }

  await fieldDefService.reloadCache();
}

/**
 * Truncates every table and re-seeds field defs + workflow rows. Use in
 * `beforeEach` so each test starts from a clean DB but still has the
 * registry-backed rows the engine reads at request time.
 *
 * Reload the WorkflowRegistry cache before AND after seeding — before so
 * seedWorkflows' "already seeded?" check reflects the empty DB, after so
 * workflow_transition_history FKs resolve to the freshly-inserted
 * workflow_definition_id rather than the previous test's stale cached id.
 * `seedAllEntityDefinitions` itself reloads the field cache.
 */
export async function resetProjectsTestDb(ctx: TestAppContext): Promise<void> {
  await cleanDatabase(ctx.db);
  const workflowRegistry = ctx.module.get(WorkflowRegistryService);
  await workflowRegistry.loadAll();
  await seedAllEntityDefinitions(ctx);
  await workflowRegistry.loadAll();
}
