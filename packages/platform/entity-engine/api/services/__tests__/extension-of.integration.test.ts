import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql, eq } from 'drizzle-orm';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService } from '@packages/logger';
import { FieldDefinitionService } from '../field-definition.service';
import { LookupResolverService } from '../lookup-resolver.service';
import { FeatureDeriverRegistry, featureDeriverRegistry } from '../feature-deriver.registry';
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
    nameField: 'title',
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
    nameField: 'title',
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

async function registerParentFields(fieldDefService: FieldDefinitionService) {
  await fieldDefService.registerStandardFields('ext_tasks', [
    { fieldKey: 'title', label: 'Title', fieldType: 'text', columnName: 'title', isRequired: true },
    { fieldKey: 'status', label: 'Status', fieldType: 'text', columnName: 'status', isRequired: true },
    { fieldKey: 'priority', label: 'Priority', fieldType: 'text', columnName: 'priority' },
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
  let eventEmitter: DomainEventEmitter;

  beforeAll(async () => {
    if (!fieldTypeRegistry.has('text')) {
      fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
    }

    const ctx = await createPlatformTestModule({
      providers: [
        { provide: FeatureDeriverRegistry, useValue: featureDeriverRegistry },
        FieldDefinitionService,
        EntityRegistryService,
        LookupResolverService,
      ],
      mocks: { automations: false },
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;

    const fieldDefService = module.get(FieldDefinitionService);
    entityRegistry = module.get(EntityRegistryService);
    eventEmitter = module.get(DomainEventEmitter);

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
    await registerParentFields(fieldDefService);

    const database = module.get(DatabaseService);
    const lookupResolver = module.get(LookupResolverService);
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

  // ---------------------------------------------------------------------------
  // Write path
  // ---------------------------------------------------------------------------

  describe('create()', () => {
    it('inserts parent + child in one transaction with parentDefaults applied', async () => {
      const actor = crypto.randomUUID();
      const response = await childService.create(
        { title: 'New filing', status: 'open', priority: 'high', ruleId: 'rule-1', periodStart: '2026-01-01' },
        actor,
      );

      expect(response.id).toBeDefined();
      expect(response.title).toBe('New filing');
      expect(response.status).toBe('open');
      expect(response.priority).toBe('high');
      expect(response.ruleId).toBe('rule-1');
      expect(response.periodStart).toBe('2026-01-01');

      const [parentRow] = await db
        .select()
        .from(parentTasks)
        .where(eq(parentTasks.id, response.id as string)) as any[];
      expect(parentRow.kind).toBe('compliance');
      expect(parentRow.title).toBe('New filing');
      expect(parentRow.createdBy).toBe(actor);

      const [childRow] = await db
        .select()
        .from(extChildTable)
        .where(eq(extChildTable.taskId, response.id as string)) as any[];
      expect(childRow.ruleId).toBe('rule-1');
      expect(childRow.periodStart).toBe('2026-01-01');
    });

    it('creates no child row when parent insert fails (transactional rollback)', async () => {
      const actor = crypto.randomUUID();
      // Missing required parent field `title` → should reject at validation time;
      // add a follow-up scenario using a DB-level constraint to prove rollback.
      await expect(
        childService.create({ status: 'open', ruleId: 'r1', periodStart: '2026-01-01' }, actor),
      ).rejects.toThrow();

      const rows = await db.select().from(extChildTable) as any[];
      expect(rows).toHaveLength(0);
    });
  });

  describe('update()', () => {
    it('writes only to parent when payload contains only parent fields', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'Before', status: 'open', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      const [childBefore] = await db.select().from(extChildTable).where(eq(extChildTable.taskId, created.id as string)) as any[];
      const childUpdatedAtBefore = childBefore.updatedAt;

      // Ensure a visible time gap so a child updatedAt bump is observable
      await new Promise((resolve) => setTimeout(resolve, 25));

      const updated = await childService.update(
        created.id as string,
        { title: 'After', priority: 'high' },
        actor,
      );

      expect(updated.title).toBe('After');
      expect(updated.priority).toBe('high');
      expect(updated.ruleId).toBe('r1');

      const [parentAfter] = await db.select().from(parentTasks).where(eq(parentTasks.id, created.id as string)) as any[];
      expect(parentAfter.title).toBe('After');
      expect(parentAfter.priority).toBe('high');

      // Parent-only edit still bumps child's updatedAt (design decision b)
      const [childAfter] = await db.select().from(extChildTable).where(eq(extChildTable.taskId, created.id as string)) as any[];
      expect(childAfter.updatedAt.getTime()).toBeGreaterThan(childUpdatedAtBefore.getTime());
    });

    it('writes only to child when payload contains only child fields', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'Keep', status: 'open', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      const [parentBefore] = await db.select().from(parentTasks).where(eq(parentTasks.id, created.id as string)) as any[];
      const parentUpdatedAtBefore = parentBefore.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 25));

      const updated = await childService.update(
        created.id as string,
        { ruleId: 'r2', periodStart: '2026-02-01' },
        actor,
      );

      expect(updated.title).toBe('Keep');
      expect(updated.ruleId).toBe('r2');
      expect(updated.periodStart).toBe('2026-02-01');

      const [parentAfter] = await db.select().from(parentTasks).where(eq(parentTasks.id, created.id as string)) as any[];
      // Parent row untouched
      expect(parentAfter.updatedAt.getTime()).toBe(parentUpdatedAtBefore.getTime());
      expect(parentAfter.title).toBe('Keep');
    });

    it('writes to both sides when payload spans parent + child fields', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'Mixed before', status: 'open', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      const updated = await childService.update(
        created.id as string,
        { title: 'Mixed after', ruleId: 'r2' },
        actor,
      );

      expect(updated.title).toBe('Mixed after');
      expect(updated.ruleId).toBe('r2');

      const [parentAfter] = await db.select().from(parentTasks).where(eq(parentTasks.id, created.id as string)) as any[];
      expect(parentAfter.title).toBe('Mixed after');
      const [childAfter] = await db.select().from(extChildTable).where(eq(extChildTable.taskId, created.id as string)) as any[];
      expect(childAfter.ruleId).toBe('r2');
    });
  });

  describe('softDelete() + restore()', () => {
    it('soft-delete flips parent.deletedAt and hides the extension from reads', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'To delete', status: 'open', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      await childService.softDelete(created.id as string, actor);

      const [parentAfter] = await db.select().from(parentTasks).where(eq(parentTasks.id, created.id as string)) as any[];
      expect(parentAfter.deletedAt).not.toBeNull();
      expect(parentAfter.deletedBy).toBe(actor);

      // Child row untouched
      const [childAfter] = await db.select().from(extChildTable).where(eq(extChildTable.taskId, created.id as string)) as any[];
      expect(childAfter).toBeDefined();

      await expect(childService.findOneOrFail(created.id as string)).rejects.toThrow(/not found/i);
    });

    it('restore() clears parent.deletedAt and returns the joined row', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'To restore', status: 'open', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );
      await childService.softDelete(created.id as string, actor);

      const restored = await childService.restore(created.id as string);

      expect(restored.id).toBe(created.id);
      expect(restored.title).toBe('To restore');
      expect(restored.ruleId).toBe('r1');

      const [parentAfter] = await db.select().from(parentTasks).where(eq(parentTasks.id, created.id as string)) as any[];
      expect(parentAfter.deletedAt).toBeNull();
      expect(parentAfter.deletedBy).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Event snapshots
  //
  // The child config's entityType is what drives the event name
  // (`ext_compliance_tasks.Created` etc). Listeners subscribed to that event
  // should see a snapshot that already has the parent's projected fields
  // merged in — the write path re-reads the joined row before emitting so
  // audit + side-effect handlers never have to rejoin.
  // ---------------------------------------------------------------------------

  describe('event snapshots for extension entities', () => {
    function captureEmits() {
      const events: Array<{ name: string; params: any }> = [];
      const spy = vi.spyOn(eventEmitter, 'emitDynamic').mockImplementation((name, params) => {
        events.push({ name, params });
      });
      return { events, spy };
    }

    it('Created event carries parent projected fields in after-snapshot', async () => {
      const { events, spy } = captureEmits();
      try {
        const actor = crypto.randomUUID();
        await childService.create(
          { title: 'Snapshot create', status: 'open', priority: 'high', ruleId: 'r-snap', periodStart: '2026-01-01' },
          actor,
        );

        const created = events.find((e) => e.name === 'ext_compliance_tasks.Created');
        expect(created).toBeDefined();
        expect(created!.params.entityType).toBe('ext_compliance_tasks');
        expect(created!.params.actorId).toBe(actor);

        const after = created!.params.payload.after as Record<string, unknown>;
        // Parent projected fields
        expect(after.title).toBe('Snapshot create');
        expect(after.status).toBe('open');
        expect(after.priority).toBe('high');
        // Child fields
        expect(after.ruleId).toBe('r-snap');
        expect(after.periodStart).toBe('2026-01-01');
      } finally {
        spy.mockRestore();
      }
    });

    it('Updated event has before + after snapshots with parent fields on both sides', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'Old title', status: 'open', priority: 'low', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      const { events, spy } = captureEmits();
      try {
        await childService.update(
          created.id as string,
          { title: 'New title', ruleId: 'r2' },
          actor,
        );

        const updated = events.find((e) => e.name === 'ext_compliance_tasks.Updated');
        expect(updated).toBeDefined();

        const before = updated!.params.payload.before as Record<string, unknown>;
        const after = updated!.params.payload.after as Record<string, unknown>;

        expect(before.title).toBe('Old title');
        expect(before.ruleId).toBe('r1');
        expect(before.priority).toBe('low');

        expect(after.title).toBe('New title');
        expect(after.ruleId).toBe('r2');
        // Untouched parent column still present in after snapshot
        expect(after.priority).toBe('low');

        const changes = updated!.params.payload.changes as string[];
        expect(changes).toEqual(expect.arrayContaining(['title', 'ruleId']));
      } finally {
        spy.mockRestore();
      }
    });

    it('parent-only update still emits Updated with a child-rooted snapshot containing parent changes', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'Before', status: 'open', priority: 'low', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      const { events, spy } = captureEmits();
      try {
        await childService.update(created.id as string, { title: 'After parent only' }, actor);

        const updated = events.find((e) => e.name === 'ext_compliance_tasks.Updated');
        expect(updated).toBeDefined();

        const after = updated!.params.payload.after as Record<string, unknown>;
        expect(after.title).toBe('After parent only');
        // Child field untouched but still present
        expect(after.ruleId).toBe('r1');

        const changes = updated!.params.payload.changes as string[];
        expect(changes).toContain('title');
        expect(changes).not.toContain('ruleId');
      } finally {
        spy.mockRestore();
      }
    });

    it('Deleted event carries a before-snapshot that includes parent fields', async () => {
      const actor = crypto.randomUUID();
      const created = await childService.create(
        { title: 'To delete', status: 'open', priority: 'high', ruleId: 'r1', periodStart: '2026-01-01' },
        actor,
      );

      const { events, spy } = captureEmits();
      try {
        await childService.softDelete(created.id as string, actor);

        const deleted = events.find((e) => e.name === 'ext_compliance_tasks.Deleted');
        expect(deleted).toBeDefined();

        const before = deleted!.params.payload.before as Record<string, unknown>;
        expect(before.title).toBe('To delete');
        expect(before.status).toBe('open');
        expect(before.priority).toBe('high');
        expect(before.ruleId).toBe('r1');
      } finally {
        spy.mockRestore();
      }
    });

    it('parent entity type does not receive a fan-out event when the child is written', async () => {
      const { events, spy } = captureEmits();
      try {
        const actor = crypto.randomUUID();
        await childService.create(
          { title: 'No fanout', status: 'open', ruleId: 'r-no-fanout', periodStart: '2026-01-01' },
          actor,
        );

        expect(events.some((e) => e.name === 'ext_compliance_tasks.Created')).toBe(true);
        expect(events.some((e) => e.name === 'ext_tasks.Created')).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
