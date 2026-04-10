import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { EventsModule, DomainEventEmitter } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { DatabaseService, users } from '@packages/database';
import { AuditModule } from '../../audit.module';
import { AuditRegistryService } from '../audit-registry.service';
import { AuditQueryService } from '../audit-query.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

/** Wait for async event listeners to complete. */
function waitForListeners() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

describe('Audit (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let registry: AuditRegistryService;
  let queryService: AuditQueryService;
  let emitter: DomainEventEmitter;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [EventsModule, RbacModule, AuditModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    registry = module.get(AuditRegistryService);
    queryService = module.get(AuditQueryService);
    emitter = module.get(DomainEventEmitter);

    registry.register('test', {
      events: ['test.EntityCreated', 'test.EntityUpdated', 'test.EntityDeleted'],
      sensitiveFields: ['password', 'secret'],
    });
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createActor(name = 'Test User') {
    const [user] = await db
      .insert(users)
      .values({ email: `${randomUUID()}@example.com`, firstName: name, lastName: 'Actor', userType: 'admin' })
      .returning();
    return user;
  }

  describe('AuditListener + AuditQueryService', () => {
    it('should write an audit log when a registered event is emitted', async () => {
      const actor = await createActor();
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity',
        entityId,
        actorId: actor.id,
        payload: { after: { name: 'New Entity', status: 'active' } },
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'test_entity', entityId });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('created');
      expect(result.data[0].eventName).toBe('test.EntityCreated');
      expect(result.data[0].actorId).toBe(actor.id);
      expect(result.data[0].after).toEqual({ name: 'New Entity', status: 'active' });
    });

    it('should resolve actor names in query results', async () => {
      const actor = await createActor('Jane');
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity',
        entityId,
        actorId: actor.id,
        payload: { after: { name: 'test' } },
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'test_entity', entityId });
      expect(result.data[0].actorName).toBe('Jane Actor');
    });

    it('should redact sensitive fields from audit snapshots', async () => {
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity',
        entityId,
        actorId: null,
        payload: {
          after: { name: 'Entity', password: 'secret123', secret: 'api-key' },
        },
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'test_entity', entityId });
      expect(result.data[0].after).toEqual({ name: 'Entity' });
    });

    it('should compute and store changes for update events', async () => {
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityUpdated', {
        entityType: 'test_entity',
        entityId,
        actorId: null,
        payload: {
          before: { name: 'Old Name', status: 'active' },
          after: { name: 'New Name', status: 'active' },
        },
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'test_entity', entityId });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('updated');
      expect(result.data[0].changes).toEqual({
        name: { from: 'Old Name', to: 'New Name' },
      });
    });

    it('should skip audit log for no-op updates (no actual changes)', async () => {
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityUpdated', {
        entityType: 'test_entity',
        entityId,
        actorId: null,
        payload: {
          before: { name: 'Same', status: 'active' },
          after: { name: 'Same', status: 'active' },
        },
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'test_entity', entityId });
      expect(result.data).toHaveLength(0);
    });

    it('should not write audit log for unregistered events', async () => {
      emitter.emitDynamic('unregistered.SomeEvent', {
        entityType: 'other',
        entityId: randomUUID(),
        actorId: null,
        payload: {},
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'other' });
      expect(result.data).toHaveLength(0);
    });
  });

  describe('AuditQueryService.list filtering', () => {
    it('should filter by entityType and entityId', async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity', entityId: id1, actorId: null,
        payload: { after: { name: 'first' } },
      });
      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity', entityId: id2, actorId: null,
        payload: { after: { name: 'second' } },
      });

      await waitForListeners();

      const result = await queryService.list({ entityType: 'test_entity', entityId: id1 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe(id1);
    });

    it('should paginate results', async () => {
      const entityId = randomUUID();
      for (let i = 0; i < 3; i++) {
        emitter.emitDynamic('test.EntityCreated', {
          entityType: 'paginate_test', entityId, actorId: null,
          payload: { after: { index: i } },
        });
      }

      await waitForListeners();

      const page1 = await queryService.list({ entityType: 'paginate_test', page: 1, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.meta.total).toBe(3);
      expect(page1.meta.totalPages).toBe(2);

      const page2 = await queryService.list({ entityType: 'paginate_test', page: 2, limit: 2 });
      expect(page2.data).toHaveLength(1);
    });

    it('should filter by action', async () => {
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity', entityId, actorId: null,
        payload: { after: { name: 'test' } },
      });
      emitter.emitDynamic('test.EntityDeleted', {
        entityType: 'test_entity', entityId, actorId: null,
        payload: { before: { name: 'test' } },
      });

      await waitForListeners();

      const created = await queryService.list({ entityType: 'test_entity', entityId, action: 'created' });
      expect(created.data).toHaveLength(1);

      const deleted = await queryService.list({ entityType: 'test_entity', entityId, action: 'deleted' });
      expect(deleted.data).toHaveLength(1);
    });
  });

  describe('AuditQueryService.findOneOrFail', () => {
    it('should retrieve a single audit record by ID', async () => {
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'test_entity', entityId, actorId: null,
        payload: { after: { name: 'test' } },
      });

      await waitForListeners();

      const list = await queryService.list({ entityType: 'test_entity', entityId });
      const record = await queryService.findOneOrFail(list.data[0].id);
      expect(record.entityId).toBe(entityId);
    });

    it('should throw NotFoundException for non-existent ID', async () => {
      await expect(queryService.findOneOrFail(randomUUID())).rejects.toThrow('Audit log entry not found');
    });
  });

  describe('AuditQueryService.getEntityHistory', () => {
    it('should return history for a specific entity', async () => {
      const entityId = randomUUID();

      emitter.emitDynamic('test.EntityCreated', {
        entityType: 'history_test', entityId, actorId: null,
        payload: { after: { name: 'first' } },
      });
      emitter.emitDynamic('test.EntityUpdated', {
        entityType: 'history_test', entityId, actorId: null,
        payload: { before: { name: 'first' }, after: { name: 'second' } },
      });

      await waitForListeners();

      const history = await queryService.getEntityHistory('history_test', entityId);
      expect(history.data).toHaveLength(2);
    });
  });

  describe('AuditRegistryService', () => {
    it('should find registrations for registered events', () => {
      const match = registry.findRegistration('test.EntityCreated');
      expect(match).not.toBeNull();
      expect(match!.moduleName).toBe('test');
    });

    it('should return null for unregistered events', () => {
      expect(registry.findRegistration('unknown.Event')).toBeNull();
    });

    it('should support wildcard registrations scoped to module prefix', () => {
      registry.register('wildcard_mod', { events: '*' });
      const match = registry.findRegistration('wildcard_mod.SomeEvent');
      expect(match).not.toBeNull();
      expect(match!.moduleName).toBe('wildcard_mod');

      const noMatch = registry.findRegistration('other.SomeEvent');
      expect(noMatch?.moduleName).not.toBe('wildcard_mod');
    });
  });
});
