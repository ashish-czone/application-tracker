import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import {
  FieldDefinitionService,
  EntityRegistryService,
  EntityDefinitionService,
} from '@packages/entity-engine';
import type { EntityConfig } from '@packages/entity-engine/types';
import { LayoutService } from '../layout.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

// ---------------------------------------------------------------------------
// Extension-of layout integration — proves that GET /layouts/{child} returns
// the parent's projected field defs alongside the child's own. Covers both
// the admin-configurable DB path (LayoutService.getLayout) and — via the
// short-circuit — the in-memory registry path.
// ---------------------------------------------------------------------------

const parentTasks = pgTable('ext_layout_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  priority: text('priority'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

const childTable = pgTable('ext_layout_compliance_tasks', {
  taskId: uuid('task_id').primaryKey(),
  ruleId: text('rule_id').notNull(),
});

function buildParentConfig(): EntityConfig {
  return {
    entityType: 'ext_layout_tasks',
    singularName: 'Task',
    pluralName: 'Tasks',
    slug: 'ext-layout-tasks',
    table: parentTasks,
    systemColumns: ['id', 'createdAt', 'updatedAt'],
    onDelete: { mode: 'hard' },
    searchColumns: [parentTasks.title],
    defaultSort: 'createdAt',
    sortableColumns: { title: parentTasks.title },
    fieldMeta: {
      title: { label: 'Title' },
      status: { label: 'Status', fieldType: 'picklist' },
      priority: { label: 'Priority', fieldType: 'picklist' },
      kind: { label: 'Kind', isSystem: true },
    },
    sections: [],
    extensionColumns: ['title', 'status', 'priority'],
    adminConfigurable: true,
    ui: { icon: 'check', nameField: 'title' },
  } as EntityConfig;
}

function buildChildConfig(): EntityConfig {
  return {
    entityType: 'ext_layout_compliance_tasks',
    singularName: 'Compliance Task',
    pluralName: 'Compliance Tasks',
    slug: 'ext-layout-compliance-tasks',
    table: childTable,
    systemColumns: ['taskId'],
    onDelete: { mode: 'hard' },
    searchColumns: [],
    defaultSort: 'ruleId',
    sortableColumns: { ruleId: childTable.ruleId },
    fieldMeta: { ruleId: { label: 'Rule' } },
    sections: [],
    extensionOf: {
      entity: 'ext_layout_tasks',
      foreignKey: 'taskId',
    },
    adminConfigurable: true,
    ui: { icon: 'check', nameField: 'ruleId' },
  } as EntityConfig;
}

describe('extensionOf layout (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let layoutService: LayoutService;
  let fieldDefService: FieldDefinitionService;
  let registry: EntityRegistryService;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      providers: [LayoutService, FieldDefinitionService, EntityRegistryService, EntityDefinitionService],
      mocks: { automations: false },
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    layoutService = module.get(LayoutService);
    fieldDefService = module.get(FieldDefinitionService);
    registry = module.get(EntityRegistryService);

    registry.register(buildParentConfig());
    registry.register(buildChildConfig());
    registry.finalize();

    await fieldDefService.registerStandardFields('ext_layout_tasks', [
      { fieldKey: 'title', label: 'Title', fieldType: 'text', columnName: 'title', isRequired: true },
      { fieldKey: 'status', label: 'Status', fieldType: 'text', columnName: 'status', isRequired: true },
      { fieldKey: 'priority', label: 'Priority', fieldType: 'text', columnName: 'priority' },
    ]);
    await fieldDefService.registerStandardFields('ext_layout_compliance_tasks', [
      { fieldKey: 'ruleId', label: 'Rule', fieldType: 'text', columnName: 'rule_id', isRequired: true },
    ]);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await fieldDefService.reloadCache();
    // Re-register after cache reload
    await fieldDefService.registerStandardFields('ext_layout_tasks', [
      { fieldKey: 'title', label: 'Title', fieldType: 'text', columnName: 'title', isRequired: true },
      { fieldKey: 'status', label: 'Status', fieldType: 'text', columnName: 'status', isRequired: true },
      { fieldKey: 'priority', label: 'Priority', fieldType: 'text', columnName: 'priority' },
    ]);
    await fieldDefService.registerStandardFields('ext_layout_compliance_tasks', [
      { fieldKey: 'ruleId', label: 'Rule', fieldType: 'text', columnName: 'rule_id', isRequired: true },
    ]);
  });

  afterAll(async () => {
    await cleanup();
  });

  it('surfaces parent projected fields in the child layout', async () => {
    const layout = await layoutService.getLayout('ext_layout_compliance_tasks', 'Standard');

    const unassigned = layout.sections.find((s) => s.id === '__unassigned__');
    expect(unassigned).toBeDefined();
    const keys = unassigned!.fields.map((f) => f.fieldKey);
    expect(keys).toEqual(expect.arrayContaining(['ruleId', 'title', 'status', 'priority']));
  });

  it('places parent projected fields in child-defined sections by fieldKey', async () => {
    const section = await layoutService.createSection('ext_layout_compliance_tasks', 'Standard', {
      name: 'Overview',
      columns: 2,
    });

    // Assign the child's own field to the section, leaving parent fields unplaced
    const ruleField = await fieldDefService.findByEntityAndKey('ext_layout_compliance_tasks', 'ruleId');
    expect(ruleField).toBeDefined();
    await layoutService.addFieldToSection(section.id, ruleField!.id, 0);

    const layout = await layoutService.getLayout('ext_layout_compliance_tasks', 'Standard');

    const overview = layout.sections.find((s) => s.name === 'Overview')!;
    expect(overview.fields.map((f) => f.fieldKey)).toEqual(['ruleId']);

    const unassigned = layout.sections.find((s) => s.id === '__unassigned__');
    expect(unassigned).toBeDefined();
    expect(unassigned!.fields.map((f) => f.fieldKey)).toEqual(
      expect.arrayContaining(['title', 'status', 'priority']),
    );
  });

  it('returns only own fields for a non-extension entity', async () => {
    registry.register({
      ...buildParentConfig(),
      entityType: 'ext_layout_standalone',
      slug: 'ext-layout-standalone',
      extensionColumns: undefined,
    } as EntityConfig);

    await fieldDefService.registerStandardFields('ext_layout_standalone', [
      { fieldKey: 'title', label: 'Title', fieldType: 'text', columnName: 'title', isRequired: true },
    ]);

    const layout = await layoutService.getLayout('ext_layout_standalone', 'Standard');
    const unassigned = layout.sections.find((s) => s.id === '__unassigned__');
    expect(unassigned).toBeDefined();
    expect(unassigned!.fields.map((f) => f.fieldKey)).toEqual(['title']);
  });
});
