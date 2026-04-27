import { Injectable, Logger, type INestApplicationContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseService, sql } from '@packages/database';
import type { SeedSource } from '@packages/database/seeder';
import { platformSystemSeedSources } from '@packages/app-shell/seeds';
import {
  EntityRegistryService,
  FieldDefinitionService,
  WORKFLOW_EXTENSION,
  seedWorkflows,
  type EntityConfig,
} from '@packages/entity-engine';
import { WorkflowRegistryService } from '@packages/workflows';
import {
  agencyE2eAdminSeedSource,
  agencySystemSeedSources,
} from '@domains/agency-api/seeds';

/**
 * Truncates every data table in the public schema and reruns the
 * minimal "system + e2e-admin" seed set. Designed for the e2e suite's
 * per-spec-file beforeAll, where each spec wants a clean DB but the
 * suite must still authenticate as the seeded e2e-admin.
 *
 * Drizzle migration tables (`__drizzle_migrations__*`) are preserved so
 * the schema itself is not rebuilt on each call.
 */
@Injectable()
export class TestHooksService {
  private readonly logger = new Logger(TestHooksService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async resetState(): Promise<{ durationMs: number; tablesTruncated: number; seedsRun: number }> {
    const startedAt = Date.now();
    const tablesTruncated = await this.truncateAllTables();
    // Reload caches against the now-empty DB BEFORE re-seeding. The platform's
    // FieldDefinitionService and WorkflowRegistryService cache rows in memory;
    // after a TRUNCATE the rows are gone but the cache still holds the old
    // UUIDs. The seed pipeline then issues `setPicklistOptions` which looks up
    // the field via cache, gets a stale ID, and fails with a FK violation
    // when inserting picklist_options. Reloading first clears the cache; the
    // seed re-inserts with new IDs; we reload again so the live request path
    // sees the new IDs.
    await this.reloadCaches();
    const seedsRun = await this.runResetSeeds();
    // Workflow definitions for non-adminConfigurable entities are NOT covered
    // by the system seed pipeline (EntityEngineSeedService skips them). Seed
    // them directly so transition endpoints have the rows they read at
    // request time. Mirrors `seedAllWorkflows` in the integration-test setup.
    await this.seedAllWorkflows();
    await this.reloadCaches();
    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `reset complete: ${tablesTruncated} tables truncated, ${seedsRun} seeds run, ${durationMs}ms`,
    );
    return { durationMs, tablesTruncated, seedsRun };
  }

  private async reloadCaches(): Promise<void> {
    const fieldDefService = this.moduleRef.get(FieldDefinitionService, { strict: false });
    const workflowRegistry = this.moduleRef.get(WorkflowRegistryService, { strict: false });
    const registry = this.moduleRef.get(EntityRegistryService, { strict: false });
    await fieldDefService.reloadCache();
    // reloadCache() only loads from DB; non-adminConfigurable entities have no
    // rows in field_definitions, so their in-memory cache entries (installed
    // at boot via populateFromRegistry) are wiped. Without this restore step
    // every write to a code-defined entity 400s with "Unknown field" because
    // the validator sees an empty fields list.
    for (const entry of registry.getAll() as EntityConfig[]) {
      if (!entry.adminConfigurable) {
        fieldDefService.populateFromRegistry(entry);
      }
    }
    await workflowRegistry.loadAll();
  }

  private async seedAllWorkflows(): Promise<void> {
    const registry = this.moduleRef.get(EntityRegistryService, { strict: false });
    const workflowExt = this.moduleRef.get(WORKFLOW_EXTENSION, { strict: false });
    for (const entry of registry.getAll() as EntityConfig[]) {
      await seedWorkflows(entry, workflowExt);
    }
  }

  private async truncateAllTables(): Promise<number> {
    const result = await this.database.db.execute<{ tablename: string }>(sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '\\_\\_drizzle\\_migrations\\_\\_%' ESCAPE '\\'
    `);
    if (result.rows.length === 0) return 0;
    const quoted = result.rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await this.database.db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`));
    return result.rows.length;
  }

  private async runResetSeeds(): Promise<number> {
    const sources: SeedSource[] = [
      ...platformSystemSeedSources(),
      ...agencySystemSeedSources(),
      agencyE2eAdminSeedSource(),
    ];

    const ctx = this.adaptModuleRefToContext();

    for (const source of sources) {
      const seedFn = await source.load();
      await seedFn(ctx);
    }
    return sources.length;
  }

  private adaptModuleRefToContext(): INestApplicationContext {
    // Seed functions only call `.get(token)`. ModuleRef supports the same
    // call shape but defaults to strict mode (current module only) — we
    // need `strict: false` to resolve providers across the app.
    return {
      get: <T>(token: unknown) => this.moduleRef.get<T>(token as never, { strict: false }),
    } as unknown as INestApplicationContext;
  }
}
