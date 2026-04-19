import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
// Test table schema (Drizzle pgTable for a lightweight test entity)
// ---------------------------------------------------------------------------

const testEntities = pgTable('test_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  status: text('status'),
  priority: text('priority'),
  amount: integer('amount'),
  isActive: boolean('is_active'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: uuid('deleted_by'),
});

// ---------------------------------------------------------------------------
// Test entity config
// ---------------------------------------------------------------------------

const TEST_ACTOR_ID = crypto.randomUUID();
const OTHER_ACTOR_ID = crypto.randomUUID();

function buildTestConfig(hooks?: EntityConfig['hooks']): EntityConfig {
  return {
    entityType: 'test_entities',
    singularName: 'Test Entity',
    pluralName: 'Test Entities',
    slug: 'test-entities',
    table: testEntities,
    systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],
    searchColumns: [testEntities.name, testEntities.email],
    defaultSort: 'createdAt',
    sortableColumns: {
      name: testEntities.name,
      createdAt: testEntities.createdAt,
      amount: testEntities.amount,
    },
    fieldMeta: {
      name: { label: 'Name', isQuickCreate: true },
      email: { label: 'Email', fieldType: 'email', isUnique: true },
      status: { label: 'Status', fieldType: 'picklist' },
      priority: { label: 'Priority', fieldType: 'picklist' },
      amount: { label: 'Amount', fieldType: 'number' },
      isActive: { label: 'Is Active', fieldType: 'boolean' },
    },
    sections: [
      { name: 'Basic Info', fields: ['name', 'email', 'status', 'priority', 'amount', 'isActive'] },
    ],
    ui: {
      icon: 'box',
      nameField: 'name',
    },
    dataAccess: {
      ownerField: 'createdBy',
    },
    hooks,
  } as EntityConfig;
}

// ---------------------------------------------------------------------------
// Helper: register standard fields so EntityService can validate payloads
// ---------------------------------------------------------------------------

async function registerTestFields(fieldDefService: FieldDefinitionService) {
  await fieldDefService.registerStandardFields('test_entities', [
    { fieldKey: 'name', label: 'Name', fieldType: 'text', columnName: 'name', isRequired: true },
    { fieldKey: 'email', label: 'Email', fieldType: 'email', columnName: 'email', isUnique: true },
    { fieldKey: 'status', label: 'Status', fieldType: 'picklist', columnName: 'status' },
    { fieldKey: 'priority', label: 'Priority', fieldType: 'picklist', columnName: 'priority' },
    { fieldKey: 'amount', label: 'Amount', fieldType: 'number', columnName: 'amount' },
    { fieldKey: 'isActive', label: 'Is Active', fieldType: 'boolean', columnName: 'is_active' },
  ]);

  await fieldDefService.setPicklistOptions('test_entities', 'status', [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Pending', value: 'pending' },
  ]);

  await fieldDefService.setPicklistOptions('test_entities', 'priority', [
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ]);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EntityService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let entityService: EntityService;
  let fieldDefService: FieldDefinitionService;
  let entityRegistry: EntityRegistryService;
  let eventEmitter: DomainEventEmitter;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Ensure field type registry is populated
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

    fieldDefService = module.get(FieldDefinitionService);
    entityRegistry = module.get(EntityRegistryService);
    eventEmitter = module.get(DomainEventEmitter);

    // Create test table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS test_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT,
        status TEXT,
        priority TEXT,
        amount INTEGER,
        is_active BOOLEAN,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);

    // Register the test entity config
    const config = buildTestConfig();
    entityRegistry.register(config);

    // Register field definitions
    await registerTestFields(fieldDefService);

    // Build the EntityService manually (same wiring as forEntity factory)
    const database = module.get(DatabaseService);
    const lookupResolver = module.get(LookupResolverService);
    const hookRegistry = module.get(FieldTypeSaveHookRegistry);
    const appLogger = module.get(AppLoggerService);

    entityService = new EntityService(
      config,
      database,
      eventEmitter,
      null, // eavStorage
      null, // multiValueExtension
      fieldDefService,
      lookupResolver,
      null, // taxonomyExt
      hookRegistry,
      null, // workflowExt
      entityRegistry,
      appLogger,
      null, // positionScopeProvider
    );
  });

  afterEach(async () => {
    // Clean test_entities table (cleanDatabase truncates all tables)
    await db.execute(sql`DELETE FROM test_entities`);
    emitSpy?.mockRestore();
  });

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS test_entities`);
    await cleanDatabase(db);
    module.get(LookupResolverService).clearRegistry();
    await cleanup();
  });

  // ---------------------------------------------------------------------------
  // Helper: quick-create for tests that need pre-existing entities
  // ---------------------------------------------------------------------------

  async function createEntity(overrides: Record<string, unknown> = {}, actorId = TEST_ACTOR_ID) {
    const defaults: Record<string, unknown> = { name: 'Test Record', status: 'active' };
    // Only add a random email if the caller hasn't explicitly set email (including to undefined)
    if (!('email' in overrides)) {
      defaults.email = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
    }
    const payload = { ...defaults, ...overrides };
    // Remove keys that are explicitly undefined
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }
    return entityService.create(payload, actorId);
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should create an entity and return it with system fields', async () => {
      const result = await entityService.create(
        { name: 'Alice', email: 'alice@example.com', status: 'active' },
        TEST_ACTOR_ID,
      );

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Alice');
      expect(result.email).toBe('alice@example.com');
      expect(result.status).toBe('active');
      expect(result.createdBy).toBe(TEST_ACTOR_ID);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.deletedAt).toBeNull();
    });

    it('should normalize email to lowercase', async () => {
      const result = await entityService.create(
        { name: 'Bob', email: 'BOB@Example.COM' },
        TEST_ACTOR_ID,
      );

      expect(result.email).toBe('bob@example.com');
    });

    it('should reject missing required fields', async () => {
      await expect(
        entityService.create({ email: 'no-name@example.com' }, TEST_ACTOR_ID),
      ).rejects.toThrow('Validation failed');
    });

    it('should reject duplicate unique fields', async () => {
      await entityService.create(
        { name: 'First', email: 'unique@example.com' },
        TEST_ACTOR_ID,
      );

      await expect(
        entityService.create(
          { name: 'Second', email: 'unique@example.com' },
          TEST_ACTOR_ID,
        ),
      ).rejects.toThrow('already exists');
    });

    it('should allow null values for optional fields', async () => {
      const result = await entityService.create(
        { name: 'Minimal' },
        TEST_ACTOR_ID,
      );

      expect(result.name).toBe('Minimal');
      expect(result.email).toBeNull();
      expect(result.status).toBeNull();
    });

    it('should emit Created event', async () => {
      emitSpy = vi.spyOn(eventEmitter, 'emitDynamic');

      const result = await entityService.create(
        { name: 'Event Test', email: 'event@example.com' },
        TEST_ACTOR_ID,
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'test_entities.Created',
        expect.objectContaining({
          entityType: 'test_entities',
          entityId: result.id,
          actorId: TEST_ACTOR_ID,
        }),
      );
    });

    it('should run beforeCreate hook', async () => {
      const hookConfig = buildTestConfig({
        beforeCreate: async (payload, _actorId) => {
          return { ...payload, priority: 'high' };
        },
      });

      const database = module.get(DatabaseService);
      const hookService = new EntityService(
        hookConfig, database, eventEmitter, null, null,
        fieldDefService, module.get(LookupResolverService), null,
        module.get(FieldTypeSaveHookRegistry), null,
        entityRegistry, module.get(AppLoggerService), null,
      );

      const result = await hookService.create(
        { name: 'Hook Test', email: 'hook@example.com' },
        TEST_ACTOR_ID,
      );

      expect(result.priority).toBe('high');
    });

    it('should run afterCreate hook', async () => {
      const afterCreateSpy = vi.fn();
      const hookConfig = buildTestConfig({
        afterCreate: afterCreateSpy,
      });

      const database = module.get(DatabaseService);
      const hookService = new EntityService(
        hookConfig, database, eventEmitter, null, null,
        fieldDefService, module.get(LookupResolverService), null,
        module.get(FieldTypeSaveHookRegistry), null,
        entityRegistry, module.get(AppLoggerService), null,
      );

      await hookService.create(
        { name: 'After Hook', email: 'afterhook@example.com' },
        TEST_ACTOR_ID,
      );

      expect(afterCreateSpy).toHaveBeenCalledOnce();
      expect(afterCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'After Hook' }),
        TEST_ACTOR_ID,
      );
    });

    it('should reject unknown fields', async () => {
      await expect(
        entityService.create(
          { name: 'Unknown', unknownField: 'value' },
          TEST_ACTOR_ID,
        ),
      ).rejects.toThrow('Validation failed');
    });
  });

  // ---------------------------------------------------------------------------
  // FIND ONE OR FAIL
  // ---------------------------------------------------------------------------

  describe('findOneOrFail', () => {
    it('should return entity by id', async () => {
      const created = await createEntity({ name: 'FindMe' });

      const found = await entityService.findOneOrFail(created.id as string);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('FindMe');
    });

    it('should throw NotFoundException for non-existent id', async () => {
      await expect(
        entityService.findOneOrFail(crypto.randomUUID()),
      ).rejects.toThrow('not found');
    });

    it('should exclude soft-deleted entities', async () => {
      const created = await createEntity({ name: 'SoftDeleted' });
      await entityService.softDelete(created.id as string, TEST_ACTOR_ID);

      await expect(
        entityService.findOneOrFail(created.id as string),
      ).rejects.toThrow('not found');
    });

    it('should filter by data access scope "own"', async () => {
      const owned = await createEntity({ name: 'Owned' }, TEST_ACTOR_ID);
      const otherOwned = await createEntity({ name: 'Other Owned' }, OTHER_ACTOR_ID);

      // Can see own
      const found = await entityService.findOneOrFail(owned.id as string, {
        userId: TEST_ACTOR_ID,
        scope: 'own',
      });
      expect(found.id).toBe(owned.id);

      // Cannot see other's
      await expect(
        entityService.findOneOrFail(otherOwned.id as string, {
          userId: TEST_ACTOR_ID,
          scope: 'own',
        }),
      ).rejects.toThrow('not found');
    });

    it('should allow all records with data access scope "all"', async () => {
      const otherOwned = await createEntity({ name: 'Other' }, OTHER_ACTOR_ID);

      const found = await entityService.findOneOrFail(otherOwned.id as string, {
        userId: TEST_ACTOR_ID,
        scope: 'all',
      });
      expect(found.id).toBe(otherOwned.id);
    });
  });

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('should return paginated results', async () => {
      await createEntity({ name: 'A' });
      await createEntity({ name: 'B' });
      await createEntity({ name: 'C' });

      const result = await entityService.list({});

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should respect page and limit', async () => {
      for (let i = 0; i < 5; i++) {
        await createEntity({ name: `Item ${i}` });
      }

      const page1 = await entityService.list({ page: 1, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.meta.total).toBe(5);
      expect(page1.meta.totalPages).toBe(3);

      const page3 = await entityService.list({ page: 3, limit: 2 });
      expect(page3.data).toHaveLength(1);
    });

    it('should search across configured search columns', async () => {
      await createEntity({ name: 'Alice Smith', email: 'xalice@test.com' });
      await createEntity({ name: 'Bob Jones', email: 'bob@test.com' });
      await createEntity({ name: 'Charlie', email: 'charlie@test.com' });

      // Search by name
      const nameResult = await entityService.list({ search: 'Alice' });
      expect(nameResult.data).toHaveLength(1);
      expect(nameResult.data[0].name).toBe('Alice Smith');

      // Search by email prefix
      const emailResult = await entityService.list({ search: 'bob@' });
      expect(emailResult.data).toHaveLength(1);
      expect(emailResult.data[0].name).toBe('Bob Jones');
    });

    it('should sort by default sort column (createdAt desc)', async () => {
      const first = await createEntity({ name: 'First' });
      const second = await createEntity({ name: 'Second' });

      const result = await entityService.list({});

      // Default sort is createdAt desc — newest first
      expect(result.data[0].name).toBe('Second');
      expect(result.data[1].name).toBe('First');
    });

    it('should sort by specified column and direction', async () => {
      await createEntity({ name: 'Banana' });
      await createEntity({ name: 'Apple' });
      await createEntity({ name: 'Cherry' });

      const ascResult = await entityService.list({ sort: 'name', order: 'asc' });
      expect(ascResult.data[0].name).toBe('Apple');
      expect(ascResult.data[1].name).toBe('Banana');
      expect(ascResult.data[2].name).toBe('Cherry');

      const descResult = await entityService.list({ sort: 'name', order: 'desc' });
      expect(descResult.data[0].name).toBe('Cherry');
    });

    it('should filter by legacy query params', async () => {
      await createEntity({ name: 'Active', status: 'active' });
      await createEntity({ name: 'Inactive', status: 'inactive' });
      await createEntity({ name: 'Pending', status: 'pending' });

      const result = await entityService.list({ status: 'active' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Active');
    });

    it('should filter using structured filters', async () => {
      await createEntity({ name: 'High Priority', priority: 'high', amount: 100 });
      await createEntity({ name: 'Low Priority', priority: 'low', amount: 50 });

      const result = await entityService.list({
        filters: JSON.stringify([
          { field: 'priority', operator: 'eq', value: 'high' },
        ]),
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('High Priority');
    });

    it('should exclude soft-deleted by default', async () => {
      const entity = await createEntity({ name: 'ToDelete' });
      await createEntity({ name: 'Alive' });
      await entityService.softDelete(entity.id as string, TEST_ACTOR_ID);

      const result = await entityService.list({});
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Alive');
    });

    it('should include soft-deleted when requested', async () => {
      const entity = await createEntity({ name: 'Deleted' });
      await createEntity({ name: 'Alive' });
      await entityService.softDelete(entity.id as string, TEST_ACTOR_ID);

      const result = await entityService.list({ includeDeleted: true });
      expect(result.data).toHaveLength(2);
    });

    it('should return empty results for no matches', async () => {
      const result = await entityService.list({ search: 'nonexistent_query' });
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should filter by data access scope "own"', async () => {
      await createEntity({ name: 'Mine' }, TEST_ACTOR_ID);
      await createEntity({ name: 'Theirs' }, OTHER_ACTOR_ID);

      const result = await entityService.list({}, {
        userId: TEST_ACTOR_ID,
        scope: 'own',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Mine');
    });
  });

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should update entity fields', async () => {
      const created = await createEntity({ name: 'Original', status: 'active' });

      const updated = await entityService.update(
        created.id as string,
        { name: 'Updated', status: 'inactive' },
        TEST_ACTOR_ID,
      );

      expect(updated.name).toBe('Updated');
      expect(updated.status).toBe('inactive');
    });

    it('should normalize email on update', async () => {
      const created = await createEntity({ name: 'EmailTest', email: 'before@test.com' });

      const updated = await entityService.update(
        created.id as string,
        { email: 'AFTER@TEST.COM' },
        TEST_ACTOR_ID,
      );

      expect(updated.email).toBe('after@test.com');
    });

    it('should emit Updated event with changes', async () => {
      const created = await createEntity({ name: 'Before' });
      emitSpy = vi.spyOn(eventEmitter, 'emitDynamic');

      await entityService.update(
        created.id as string,
        { name: 'After' },
        TEST_ACTOR_ID,
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'test_entities.Updated',
        expect.objectContaining({
          entityType: 'test_entities',
          entityId: created.id,
          actorId: TEST_ACTOR_ID,
          payload: expect.objectContaining({
            changes: expect.arrayContaining(['name']),
          }),
        }),
      );
    });

    it('should not emit event when no changes are made', async () => {
      const created = await createEntity({ name: 'NoChange', status: 'active' });
      emitSpy = vi.spyOn(eventEmitter, 'emitDynamic');

      await entityService.update(
        created.id as string,
        { name: 'NoChange', status: 'active' },
        TEST_ACTOR_ID,
      );

      // emitDynamic should not be called for Updated event (no changes)
      const updatedCalls = emitSpy.mock.calls.filter(
        (call) => call[0] === 'test_entities.Updated',
      );
      expect(updatedCalls).toHaveLength(0);
    });

    it('should throw on non-existent entity', async () => {
      await expect(
        entityService.update(crypto.randomUUID(), { name: 'Ghost' }, TEST_ACTOR_ID),
      ).rejects.toThrow('not found');
    });

    it('should validate unique constraint on update', async () => {
      await createEntity({ name: 'Existing', email: 'taken@example.com' });
      const other = await createEntity({ name: 'Other', email: 'other@example.com' });

      await expect(
        entityService.update(
          other.id as string,
          { email: 'taken@example.com' },
          TEST_ACTOR_ID,
        ),
      ).rejects.toThrow('already exists');
    });

    it('should allow updating to the same unique value (self)', async () => {
      const created = await createEntity({ name: 'Self', email: 'self@example.com' });

      // Updating with the same email should not throw
      const updated = await entityService.update(
        created.id as string,
        { email: 'self@example.com' },
        TEST_ACTOR_ID,
      );
      expect(updated.email).toBe('self@example.com');
    });

    it('should run beforeUpdate hook', async () => {
      const hookConfig = buildTestConfig({
        beforeUpdate: async (_id, payload, _actorId) => {
          return { ...payload, priority: 'low' };
        },
      });

      const database = module.get(DatabaseService);
      const hookService = new EntityService(
        hookConfig, database, eventEmitter, null, null,
        fieldDefService, module.get(LookupResolverService), null,
        module.get(FieldTypeSaveHookRegistry), null,
        entityRegistry, module.get(AppLoggerService), null,
      );

      const created = await hookService.create(
        { name: 'HookUpdate', email: 'hookupdate@example.com' },
        TEST_ACTOR_ID,
      );

      const updated = await hookService.update(
        created.id as string,
        { name: 'Changed' },
        TEST_ACTOR_ID,
      );

      expect(updated.priority).toBe('low');
    });

    it('should return unchanged entity when payload is empty', async () => {
      const created = await createEntity({ name: 'Unchanged', status: 'active' });

      const result = await entityService.update(
        created.id as string,
        {},
        TEST_ACTOR_ID,
      );

      expect(result.name).toBe('Unchanged');
      expect(result.status).toBe('active');
    });
  });

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  describe('softDelete', () => {
    it('should set deletedAt and deletedBy', async () => {
      const created = await createEntity({ name: 'ToDelete' });

      await entityService.softDelete(created.id as string, TEST_ACTOR_ID);

      // Verify via raw query (findOneOrFail excludes deleted)
      const result = await db.execute(
        sql`SELECT deleted_at, deleted_by FROM test_entities WHERE id = ${created.id as string}`,
      );
      const row = (result as any).rows?.[0] ?? (result as any[])[0];
      expect(row.deleted_at).not.toBeNull();
      expect(row.deleted_by).toBe(TEST_ACTOR_ID);
    });

    it('should emit Deleted event', async () => {
      const created = await createEntity({ name: 'DeleteEvent' });
      emitSpy = vi.spyOn(eventEmitter, 'emitDynamic');

      await entityService.softDelete(created.id as string, TEST_ACTOR_ID);

      expect(emitSpy).toHaveBeenCalledWith(
        'test_entities.Deleted',
        expect.objectContaining({
          entityType: 'test_entities',
          entityId: created.id,
          actorId: TEST_ACTOR_ID,
        }),
      );
    });

    it('should throw on non-existent entity', async () => {
      await expect(
        entityService.softDelete(crypto.randomUUID(), TEST_ACTOR_ID),
      ).rejects.toThrow('not found');
    });

    it('should run beforeDelete hook', async () => {
      const beforeDeleteSpy = vi.fn();
      const hookConfig = buildTestConfig({
        beforeDelete: beforeDeleteSpy,
      });

      const database = module.get(DatabaseService);
      const hookService = new EntityService(
        hookConfig, database, eventEmitter, null, null,
        fieldDefService, module.get(LookupResolverService), null,
        module.get(FieldTypeSaveHookRegistry), null,
        entityRegistry, module.get(AppLoggerService), null,
      );

      const created = await hookService.create(
        { name: 'DeleteHook', email: 'deletehook@example.com' },
        TEST_ACTOR_ID,
      );

      await hookService.softDelete(created.id as string, TEST_ACTOR_ID);

      expect(beforeDeleteSpy).toHaveBeenCalledWith(created.id, TEST_ACTOR_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // RESTORE
  // ---------------------------------------------------------------------------

  describe('restore', () => {
    it('should clear deletedAt and deletedBy', async () => {
      const created = await createEntity({ name: 'Restorable' });
      await entityService.softDelete(created.id as string, TEST_ACTOR_ID);

      const restored = await entityService.restore(created.id as string);

      expect(restored.deletedAt).toBeNull();
      expect(restored.name).toBe('Restorable');
    });

    it('should make entity findable again', async () => {
      const created = await createEntity({ name: 'RestoreAndFind' });
      await entityService.softDelete(created.id as string, TEST_ACTOR_ID);
      await entityService.restore(created.id as string);

      const found = await entityService.findOneOrFail(created.id as string);
      expect(found.name).toBe('RestoreAndFind');
    });

    it('should throw for non-existent entity', async () => {
      await expect(
        entityService.restore(crypto.randomUUID()),
      ).rejects.toThrow('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // CLONE
  // ---------------------------------------------------------------------------

  describe('clone', () => {
    it('should create a new entity from an existing one', async () => {
      // Omit email (unique field) to avoid conflict on clone
      const source = await createEntity({
        name: 'Original',
        status: 'active',
        priority: 'high',
        amount: 100,
        email: undefined,
      });

      const cloned = await entityService.clone(source.id as string, TEST_ACTOR_ID);

      expect(cloned.id).not.toBe(source.id);
      expect(cloned.name).toBe('Copy of Original');
      expect(cloned.status).toBe('active');
      expect(cloned.priority).toBe('high');
      expect(cloned.amount).toBe(100);
    });

    it('should set createdBy to the cloning actor', async () => {
      const source = await createEntity({ name: 'Source', email: undefined }, TEST_ACTOR_ID);

      const cloned = await entityService.clone(source.id as string, OTHER_ACTOR_ID);

      expect(cloned.createdBy).toBe(OTHER_ACTOR_ID);
    });

    it('should throw ConflictException when cloning entity with unique field', async () => {
      const source = await createEntity({
        name: 'Unique Source',
        email: 'unique-clone@example.com',
      });

      // Clone copies email (unique), causing a conflict
      await expect(
        entityService.clone(source.id as string, TEST_ACTOR_ID),
      ).rejects.toThrow('already exists');
    });
  });

  // ---------------------------------------------------------------------------
  // GET LIST LAYOUT
  // ---------------------------------------------------------------------------

  describe('getListLayout', () => {
    it('should return columns, actions, and filters', async () => {
      const layout = await entityService.getListLayout();

      expect(layout.columns).toBeDefined();
      expect(layout.columns.length).toBeGreaterThan(0);
      expect(layout.actions).toBeDefined();
      expect(layout.filters).toBeDefined();
      expect(layout.defaultSort).toBe('createdAt');
      expect(layout.defaultOrder).toBe('desc');
    });

    it('should include sortable flag on sortable columns', async () => {
      const layout = await entityService.getListLayout();

      const nameCol = layout.columns.find(c => c.fieldKey === 'name');
      const statusCol = layout.columns.find(c => c.fieldKey === 'status');

      expect(nameCol?.sortable).toBe(true);
      expect(statusCol?.sortable).toBe(false);
    });

    it('should include picklist options on picklist columns', async () => {
      const layout = await entityService.getListLayout();

      const statusCol = layout.columns.find(c => c.fieldKey === 'status');
      expect(statusCol?.picklistOptions).toBeDefined();
      expect(statusCol!.picklistOptions!.length).toBe(3);
      expect(statusCol!.picklistOptions![0]).toEqual(
        expect.objectContaining({ label: 'Active', value: 'active' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET CONFIG
  // ---------------------------------------------------------------------------

  describe('getConfig', () => {
    it('should return the entity configuration', () => {
      const config = entityService.getConfig();

      expect(config.entityType).toBe('test_entities');
      expect(config.singularName).toBe('Test Entity');
      expect(config.slug).toBe('test-entities');
    });
  });
});
