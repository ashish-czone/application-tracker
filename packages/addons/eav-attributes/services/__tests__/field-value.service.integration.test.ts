import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { sql } from '@packages/database';
import { FieldValueService } from '../field-value.service';
import { entityFieldValues } from '../../schema/entity-field-values';
import { fieldDefinitions } from '../../schema/field-definitions';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

const ENTITY_TYPE = 'test_entity';

describe('FieldValueService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let fieldValueService: FieldValueService;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      providers: [FieldValueService],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    fieldValueService = module.get(FieldValueService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  /** Insert a field definition for the test entity type. */
  async function createFieldDef(opts: {
    fieldKey: string;
    fieldType: string;
    isUnique?: boolean;
  }) {
    const id = randomUUID();
    await db.insert(fieldDefinitions).values({
      id,
      entityType: ENTITY_TYPE,
      fieldKey: opts.fieldKey,
      label: opts.fieldKey,
      fieldType: opts.fieldType,
      isUnique: opts.isUnique ?? false,
    });
    return id;
  }

  /** Seed common field definitions. */
  async function seedFields() {
    await createFieldDef({ fieldKey: 'company', fieldType: 'text' });
    await createFieldDef({ fieldKey: 'salary', fieldType: 'number' });
    await createFieldDef({ fieldKey: 'is_active', fieldType: 'boolean' });
    await createFieldDef({ fieldKey: 'start_date', fieldType: 'date' });
    await createFieldDef({ fieldKey: 'last_login', fieldType: 'datetime' });
  }

  // ---------- setValues + getValues ----------

  describe('setValues & getValues', () => {
    it('should store and retrieve text values', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        company: 'Acme Corp',
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.company).toBe('Acme Corp');
    });

    it('should store and retrieve number values', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        salary: 75000,
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.salary).toBe(75000);
    });

    it('should store and retrieve boolean values', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        is_active: true,
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.is_active).toBe(true);
    });

    it('should store and retrieve date values', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        start_date: '2026-04-01',
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.start_date).toBe('2026-04-01');
    });

    it('should store multiple values at once', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        company: 'TechCorp',
        salary: 90000,
        is_active: false,
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.company).toBe('TechCorp');
      expect(values.salary).toBe(90000);
      expect(values.is_active).toBe(false);
    });

    it('should return before/after snapshots', async () => {
      await seedFields();
      const entityId = randomUUID();

      const first = await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        company: 'First',
      });
      expect(first.before).toEqual({});
      expect(first.after.company).toBe('First');

      const second = await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        company: 'Second',
      });
      expect(second.before.company).toBe('First');
      expect(second.after.company).toBe('Second');
    });

    it('should upsert (update existing values)', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, { company: 'Old' });
      await fieldValueService.setValues(ENTITY_TYPE, entityId, { company: 'New' });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.company).toBe('New');

      // Verify only one row exists (not two)
      const rows = await db
        .select()
        .from(entityFieldValues)
        .where(sql`${entityFieldValues.entityType} = ${ENTITY_TYPE} AND ${entityFieldValues.entityId} = ${entityId}`);
      expect(rows).toHaveLength(1);
    });

    it('should delete value when set to null', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, { company: 'Delete Me' });
      await fieldValueService.setValues(ENTITY_TYPE, entityId, { company: null });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.company).toBeUndefined();
    });

    it('should skip unknown field keys', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        unknown_field: 'should be ignored',
        company: 'Should be saved',
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.company).toBe('Should be saved');
      expect(values.unknown_field).toBeUndefined();
    });

    it('should return empty object for entity with no values', async () => {
      const values = await fieldValueService.getValues(ENTITY_TYPE, randomUUID());
      expect(values).toEqual({});
    });
  });

  // ---------- getBatchValues ----------

  describe('getBatchValues', () => {
    it('should return values for multiple entities', async () => {
      await seedFields();
      const entity1 = randomUUID();
      const entity2 = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entity1, { company: 'Company A' });
      await fieldValueService.setValues(ENTITY_TYPE, entity2, { company: 'Company B' });

      const batch = await fieldValueService.getBatchValues(ENTITY_TYPE, [entity1, entity2]);
      expect(batch.get(entity1)!.company).toBe('Company A');
      expect(batch.get(entity2)!.company).toBe('Company B');
    });

    it('should filter by field keys when provided', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        company: 'Acme',
        salary: 50000,
      });

      const batch = await fieldValueService.getBatchValues(ENTITY_TYPE, [entityId], ['company']);
      const values = batch.get(entityId)!;
      expect(values.company).toBe('Acme');
      expect(values.salary).toBeUndefined();
    });

    it('should return empty map for empty entity IDs', async () => {
      const batch = await fieldValueService.getBatchValues(ENTITY_TYPE, []);
      expect(batch.size).toBe(0);
    });
  });

  // ---------- deleteValues ----------

  describe('deleteValues', () => {
    it('should delete all values for an entity', async () => {
      await seedFields();
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, {
        company: 'Acme',
        salary: 50000,
      });

      await fieldValueService.deleteValues(ENTITY_TYPE, entityId);

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values).toEqual({});
    });

    it('should not affect other entities', async () => {
      await seedFields();
      const entity1 = randomUUID();
      const entity2 = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entity1, { company: 'A' });
      await fieldValueService.setValues(ENTITY_TYPE, entity2, { company: 'B' });

      await fieldValueService.deleteValues(ENTITY_TYPE, entity1);

      const values = await fieldValueService.getValues(ENTITY_TYPE, entity2);
      expect(values.company).toBe('B');
    });
  });

  // ---------- checkUniqueness ----------

  describe('checkUniqueness', () => {
    it('should return true when no duplicate exists', async () => {
      await createFieldDef({ fieldKey: 'email', fieldType: 'text', isUnique: true });
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, { email: 'unique@test.com' });

      const isUnique = await fieldValueService.checkUniqueness(ENTITY_TYPE, 'email', 'other@test.com');
      expect(isUnique).toBe(true);
    });

    it('should return false when duplicate exists', async () => {
      await createFieldDef({ fieldKey: 'email', fieldType: 'text', isUnique: true });
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, { email: 'taken@test.com' });

      const isUnique = await fieldValueService.checkUniqueness(ENTITY_TYPE, 'email', 'taken@test.com');
      expect(isUnique).toBe(false);
    });

    it('should exclude specified entity from check', async () => {
      await createFieldDef({ fieldKey: 'email', fieldType: 'text', isUnique: true });
      const entityId = randomUUID();

      await fieldValueService.setValues(ENTITY_TYPE, entityId, { email: 'mine@test.com' });

      // Should be unique when excluding the entity that has it
      const isUnique = await fieldValueService.checkUniqueness(ENTITY_TYPE, 'email', 'mine@test.com', entityId);
      expect(isUnique).toBe(true);
    });

    it('should return true for non-unique fields', async () => {
      await createFieldDef({ fieldKey: 'notes', fieldType: 'text', isUnique: false });

      const isUnique = await fieldValueService.checkUniqueness(ENTITY_TYPE, 'notes', 'any value');
      expect(isUnique).toBe(true);
    });
  });

  // ---------- transaction support ----------

  describe('transaction support', () => {
    it('should use caller-provided transaction for setValues', async () => {
      await seedFields();
      const entityId = randomUUID();

      await db.transaction(async (tx) => {
        await fieldValueService.setValues(ENTITY_TYPE, entityId, { company: 'TxCorp' }, tx);
      });

      const values = await fieldValueService.getValues(ENTITY_TYPE, entityId);
      expect(values.company).toBe('TxCorp');
    });
  });
});
