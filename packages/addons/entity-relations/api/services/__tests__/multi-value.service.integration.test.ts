import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { sql } from '@packages/database';
import { MultiValueService } from '../multi-value.service';
import { entityMultiValues } from '../../schema/entity-multi-values';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('MultiValueService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let multiValueService: MultiValueService;

  const ENTITY_TYPE = 'test_entity';

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      providers: [MultiValueService],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    multiValueService = module.get(MultiValueService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  // ---------- setValues + getValues ----------

  describe('setValues & getValues', () => {
    it('should store and retrieve target IDs in order', async () => {
      const entityId = randomUUID();
      const target1 = randomUUID();
      const target2 = randomUUID();
      const target3 = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [target1, target2, target3]);

      const values = await multiValueService.getValues(ENTITY_TYPE, entityId, 'assignees');
      expect(values).toEqual([target1, target2, target3]);
    });

    it('should replace existing values on subsequent set', async () => {
      const entityId = randomUUID();
      const oldTarget = randomUUID();
      const newTarget1 = randomUUID();
      const newTarget2 = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [oldTarget]);
      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [newTarget1, newTarget2]);

      const values = await multiValueService.getValues(ENTITY_TYPE, entityId, 'assignees');
      expect(values).toEqual([newTarget1, newTarget2]);
      expect(values).not.toContain(oldTarget);
    });

    it('should clear values when setting empty array', async () => {
      const entityId = randomUUID();
      const target = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [target]);
      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', []);

      const values = await multiValueService.getValues(ENTITY_TYPE, entityId, 'assignees');
      expect(values).toEqual([]);
    });

    it('should preserve sort order based on array index', async () => {
      const entityId = randomUUID();
      const targets = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'recruiters', targets);

      // Verify the order by reading directly from DB
      const rows = await db
        .select({ targetId: entityMultiValues.targetId, sortOrder: entityMultiValues.sortOrder })
        .from(entityMultiValues)
        .where(sql`${entityMultiValues.entityType} = ${ENTITY_TYPE} AND ${entityMultiValues.entityId} = ${entityId}`)
        .orderBy(entityMultiValues.sortOrder);

      expect(rows.map(r => r.targetId)).toEqual(targets);
      expect(rows.map(r => r.sortOrder)).toEqual([0, 1, 2, 3]);
    });

    it('should handle different field keys independently', async () => {
      const entityId = randomUUID();
      const assignee = randomUUID();
      const reviewer = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [assignee]);
      await multiValueService.setValues(ENTITY_TYPE, entityId, 'reviewers', [reviewer]);

      const assignees = await multiValueService.getValues(ENTITY_TYPE, entityId, 'assignees');
      const reviewers = await multiValueService.getValues(ENTITY_TYPE, entityId, 'reviewers');

      expect(assignees).toEqual([assignee]);
      expect(reviewers).toEqual([reviewer]);
    });

    it('should return empty array for non-existent entity', async () => {
      const values = await multiValueService.getValues(ENTITY_TYPE, randomUUID(), 'assignees');
      expect(values).toEqual([]);
    });
  });

  // ---------- setValues with transaction ----------

  describe('setValues with transaction', () => {
    it('should use caller-provided transaction', async () => {
      const entityId = randomUUID();
      const target = randomUUID();

      await db.transaction(async (tx) => {
        await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [target], tx);
      });

      const values = await multiValueService.getValues(ENTITY_TYPE, entityId, 'assignees');
      expect(values).toEqual([target]);
    });
  });

  // ---------- getAllForEntity ----------

  describe('getAllForEntity', () => {
    it('should return all fields grouped by field key', async () => {
      const entityId = randomUUID();
      const assignee1 = randomUUID();
      const assignee2 = randomUUID();
      const reviewer = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [assignee1, assignee2]);
      await multiValueService.setValues(ENTITY_TYPE, entityId, 'reviewers', [reviewer]);

      const all = await multiValueService.getAllForEntity(ENTITY_TYPE, entityId);
      expect(all).toEqual({
        assignees: [assignee1, assignee2],
        reviewers: [reviewer],
      });
    });

    it('should return empty object for entity with no multi-values', async () => {
      const all = await multiValueService.getAllForEntity(ENTITY_TYPE, randomUUID());
      expect(all).toEqual({});
    });

    it('should preserve sort order within each field key', async () => {
      const entityId = randomUUID();
      const targets = [randomUUID(), randomUUID(), randomUUID()];

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', targets);

      const all = await multiValueService.getAllForEntity(ENTITY_TYPE, entityId);
      expect(all.assignees).toEqual(targets);
    });
  });

  // ---------- removeAllForEntity ----------

  describe('removeAllForEntity', () => {
    it('should remove all multi-values for an entity', async () => {
      const entityId = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId, 'assignees', [randomUUID()]);
      await multiValueService.setValues(ENTITY_TYPE, entityId, 'reviewers', [randomUUID()]);

      await multiValueService.removeAllForEntity(ENTITY_TYPE, entityId);

      const all = await multiValueService.getAllForEntity(ENTITY_TYPE, entityId);
      expect(all).toEqual({});
    });

    it('should not affect other entities', async () => {
      const entityId1 = randomUUID();
      const entityId2 = randomUUID();
      const target = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entityId1, 'assignees', [randomUUID()]);
      await multiValueService.setValues(ENTITY_TYPE, entityId2, 'assignees', [target]);

      await multiValueService.removeAllForEntity(ENTITY_TYPE, entityId1);

      const values = await multiValueService.getValues(ENTITY_TYPE, entityId2, 'assignees');
      expect(values).toEqual([target]);
    });

    it('should not throw when entity has no multi-values', async () => {
      await expect(
        multiValueService.removeAllForEntity(ENTITY_TYPE, randomUUID()),
      ).resolves.toBeUndefined();
    });
  });

  // ---------- findEntitiesByTarget ----------

  describe('findEntitiesByTarget', () => {
    it('should find entities referencing a specific target', async () => {
      const entity1 = randomUUID();
      const entity2 = randomUUID();
      const entity3 = randomUUID();
      const target = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entity1, 'assignees', [target]);
      await multiValueService.setValues(ENTITY_TYPE, entity2, 'assignees', [target]);
      await multiValueService.setValues(ENTITY_TYPE, entity3, 'assignees', [randomUUID()]);

      const entityIds = await multiValueService.findEntitiesByTarget(ENTITY_TYPE, 'assignees', target);
      expect(entityIds).toHaveLength(2);
      expect(entityIds).toContain(entity1);
      expect(entityIds).toContain(entity2);
    });

    it('should return empty array when no entities reference the target', async () => {
      const entityIds = await multiValueService.findEntitiesByTarget(ENTITY_TYPE, 'assignees', randomUUID());
      expect(entityIds).toEqual([]);
    });

    it('should only match the specified field key', async () => {
      const entity = randomUUID();
      const target = randomUUID();

      await multiValueService.setValues(ENTITY_TYPE, entity, 'assignees', [target]);

      const found = await multiValueService.findEntitiesByTarget(ENTITY_TYPE, 'reviewers', target);
      expect(found).toEqual([]);
    });
  });

  // ---------- composite primary key behavior ----------

  describe('primary key constraints', () => {
    it('should prevent duplicate (entityType, entityId, fieldKey, targetId) combinations', async () => {
      const entityId = randomUUID();
      const target = randomUUID();

      // Insert directly to test the constraint
      await db.insert(entityMultiValues).values({
        entityType: ENTITY_TYPE,
        entityId,
        fieldKey: 'assignees',
        targetId: target,
        sortOrder: 0,
      });

      await expect(
        db.insert(entityMultiValues).values({
          entityType: ENTITY_TYPE,
          entityId,
          fieldKey: 'assignees',
          targetId: target,
          sortOrder: 1,
        }),
      ).rejects.toThrow();
    });
  });
});
