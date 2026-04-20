import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql, eq } from 'drizzle-orm';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService } from '@packages/logger';
import { FieldDefinitionService } from '../field-definition.service';
import { LookupResolverService } from '../lookup-resolver.service';
import { FieldTypeSaveHookRegistry } from '../field-type-save-hook.registry';
import { EntityRegistryService } from '../../entity-registry.service';
import { EntityService } from '../../entity.service';
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '../../field-types';
import type { EntityConfig } from '../../types';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

// ---------------------------------------------------------------------------
// Schema — a parent "tasks" table and a 1-1 extension "compliance tasks"
// table whose primary key is also the FK to the parent. Mirrors the shape
// the real compliance_tasks/tasks pair uses, kept minimal for the test.
// ---------------------------------------------------------------------------

const parentTasks = pgTable('ext_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  priority: text('priority'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: uuid('deleted_by'),
});

const extChildTable = pgTable('ext_compliance_tasks', {
  taskId: uuid('task_id').primaryKey(),
  ruleId: text('rule_id').notNull(),
  periodStart: text('period_start').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------

function buildParentConfig(): EntityConfig {
  return {
    entityType: 'ext_tasks',
    singularName: 'Task',
    pluralName: 'Tasks',
    slug: 'ext-tasks',
    table: parentTasks,
    systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],
    onDelete: { mode: 'soft' },
    searchColumns: [parentTasks.title],
    defaultSort: 'createdAt',
    sortableColumns: {
      title: parentTasks.title,
      priority: parentTasks.priority,
      createdAt: parentTasks.createdAt,
    },
    fieldMeta: {
      title: { label: 'Title' },
      status: { label: 'Status', fieldType: 'picklist' },
      priority: { label: 'Priority', fieldType: 'picklist' },
      kind: { label: 'Kind', isSystem: true },
    },
    sections: [],
    extensionColumns: ['title', 'status', 'priority'],
    ui: { icon: 'check', nameField: 'title' },
  } as EntityConfig;
}

function buildChildConfig(): EntityConfig {
  return {
    entityType: 'ext_compliance_tasks',
    singularName: 'Compliance Task',
    pluralName: 'Compliance Tasks',
    slug: 'ext-compliance-tasks',
    table: extChildTable,
    systemColumns: ['id', 'createdAt', 'updatedAt', 'taskId'],
    onDelete: { mode: 'hard' },
    searchColumns: [],
    defaultSort: 'createdAt',
    sortableColumns: {
      ruleId: extChildTable.ruleId,
      createdAt: extChildTable.createdAt,
    },
    fieldMeta: {
      ruleId: { label: 'Rule' },
      periodStart: { label: 'Period Start', fieldType: 'date' },
    },
    sections: [],
    extensionOf: {
      entity: 'ext_tasks',
      foreignKey: 'taskId',
      parentDefaults: { kind: 'compliance' },
    },
    ui: { icon: 'check', nameField: 'title' },
  } as EntityConfig;
}

// ---------------------------------------------------------------------------
// Field defs — registered so EntityService can validate / build column maps.
// Only child fields are registered; projected parent columns reach the read
// path through the extensionMeta resolution, not through field defs.
// ---------------------------------------------------------------------------

async function registerChildFields(fieldDefService: FieldDefinitionService) {
  await fieldDefService.registerStandardFields('ext_compliance_tasks', [
    { fieldKey: 'ruleId', label: 'Rule', fieldType: 'text', columnName: 'rule_id', isRequired: true },
    { fieldKey: 'periodStart', label: 'Period Start', fieldType: 'date', columnName: 'period_start', isRequired: true },
  ]);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EntityService extensionOf (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let childService: EntityService;
  let entityRegistry: EntityRegistryService;

  beforeAll(async () => {
    if (!fieldTypeRegistry.has('text')) {
      fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
    }

    const ctx = await createPlatformTestModule({
      providers: [
        FieldDefinitionService,
        EntityRegistryService,
        LookupResolverService,
        FieldTypeSaveHookRegistry,
      ],
      mocks: { automations: false },
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;

    const fieldDefService = module.get(FieldDefinitionService);
    entityRegistry = module.get(EntityRegistryService);
    const eventEmitter = module.get(DomainEventEmitter);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ext_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ext_compliance_tasks (
        task_id UUID PRIMARY KEY REFERENCES ext_tasks(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL,
        period_start TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    const parentConfig = buildParentConfig();
    const childConfig = buildChildConfig();
    entityRegistry.register(parentConfig);
    entityRegistry.register(childConfig);
    entityRegistry.finalize();

    await registerChildFields(fieldDefService);

    const database = module.get(DatabaseService);
    const lookupResolver = module.get(LookupResolverService);
    const hookRegistry = module.get(FieldTypeSaveHookRegistry);
    const appLogger = module.get(AppLoggerService);

    childService = new EntityService(
      childConfig,
      database,
      eventEmitter,
      null,
      null,
      fieldDefService,
      lookupResolver,
      null,
      hookRegistry,
      null,
      entityRegistry,
      appLogger,
      null,
    );
  });

  afterEach(async () => {
    await db.execute(sql`DELETE FROM ext_compliance_tasks`);
    await db.execute(sql`DELETE FROM ext_tasks`);
  });

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS ext_compliance_tasks`);
    await db.execute(sql`DROP TABLE IF EXISTS ext_tasks`);
    await cleanDatabase(db);
    module.get(LookupResolverService).clearRegistry();
    await cleanup();
  });

  // --- Helpers ---

  async function insertExtension(
    overrides: Partial<{
      title: string; status: string; priority: string | null;
      ruleId: string; periodStart: string;
      deletedAt: Date | null;
    }> = {},
  ): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await db.insert(parentTasks).values({
      id,
      kind: 'compliance',
      title: overrides.title ?? 'Sample',
      status: overrides.status ?? 'open',
      priority: overrides.priority ?? null,
      deletedAt: overrides.deletedAt ?? null,
    });
    await db.insert(extChildTable).values({
      taskId: id,
      ruleId: overrides.ruleId ?? 'rule-1',
      periodStart: overrides.periodStart ?? '2026-01-01',
    });
    return { id };
  }

  // -------------------------------------------------------------------------
  // Tests
  // -------------------------------------------------------------------------

  it('list() projects parent columns onto child rows', async () => {
    await insertExtension({ title: 'GST Return', status: 'open', priority: 'high', ruleId: 'rule-A' });
    await insertExtension({ title: 'TDS Filing', status: 'done', priority: 'low', ruleId: 'rule-B' });

    const result = await childService.list({});
    expect(result.data).toHaveLength(2);
    for (const row of result.data) {
      expect(row.id).toBeDefined();
      expect(row.ruleId).toBeDefined();
      expect(row.title).toBeDefined();
      expect(row.status).toBeDefined();
      expect(row.priority !== undefined).toBe(true);
    }
  });

  it('findOneOrFail() returns child + projected parent columns by id', async () => {
    const { id } = await insertExtension({ title: 'GST Return', status: 'open', priority: 'high', ruleId: 'rule-A' });

    const row = await childService.findOneOrFail(id);

    expect(row.id).toBe(id);
    expect(row.ruleId).toBe('rule-A');
    expect(row.title).toBe('GST Return');
    expect(row.status).toBe('open');
    expect(row.priority).toBe('high');
  });

  it('list() filters by a projected parent column', async () => {
    await insertExtension({ title: 'A', status: 'open', ruleId: 'r1' });
    await insertExtension({ title: 'B', status: 'done', ruleId: 'r2' });
    await insertExtension({ title: 'C', status: 'open', ruleId: 'r3' });

    const result = await childService.list({ status: 'open' });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => r.status === 'open')).toBe(true);
  });

  it('list() sorts by a projected parent column', async () => {
    await insertExtension({ title: 'A', priority: 'low' });
    await insertExtension({ title: 'B', priority: 'high' });
    await insertExtension({ title: 'C', priority: 'medium' });

    const result = await childService.list({ sort: 'priority', order: 'asc' });
    const order = result.data.map((r) => r.priority);
    // Lexicographic asc: 'high', 'low', 'medium'
    expect(order).toEqual(['high', 'low', 'medium']);
  });

  it('list() searches across parent searchable columns', async () => {
    await insertExtension({ title: 'GST Return Q1', ruleId: 'r1' });
    await insertExtension({ title: 'TDS Filing Q1', ruleId: 'r2' });
    await insertExtension({ title: 'GST Return Q2', ruleId: 'r3' });

    const result = await childService.list({ search: 'GST' });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => (r.title as string).includes('GST'))).toBe(true);
  });

  it('list() hides extension rows whose parent is soft-deleted', async () => {
    await insertExtension({ title: 'Live', ruleId: 'r1' });
    const deleted = await insertExtension({ title: 'Gone', ruleId: 'r2' });
    await db.update(parentTasks).set({ deletedAt: new Date() }).where(eq(parentTasks.id, deleted.id));

    const result = await childService.list({});
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Live');
  });

  it('findOneOrFail() rejects a soft-deleted extension row', async () => {
    const { id } = await insertExtension({ title: 'Gone' });
    await db.update(parentTasks).set({ deletedAt: new Date() }).where(eq(parentTasks.id, id));

    await expect(childService.findOneOrFail(id)).rejects.toThrow(/not found/i);
  });

  it('list() includeDeleted=true surfaces soft-deleted extension rows', async () => {
    const { id } = await insertExtension({ title: 'Gone' });
    await db.update(parentTasks).set({ deletedAt: new Date() }).where(eq(parentTasks.id, id));

    const result = await childService.list({ includeDeleted: true });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(id);
  });

  it('count metadata reflects post-join filter (parent soft-delete)', async () => {
    await insertExtension({ title: 'Live' });
    const deleted = await insertExtension({ title: 'Gone' });
    await db.update(parentTasks).set({ deletedAt: new Date() }).where(eq(parentTasks.id, deleted.id));

    const result = await childService.list({});
    expect(result.meta.total).toBe(1);
  });
});
