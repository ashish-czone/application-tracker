import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pgTable, uuid, jsonb, text } from 'drizzle-orm/pg-core';
import { JsonbStorageAdapter } from '../jsonb-storage.adapter';
import { EntityRegistryService } from '../../entity-registry.service';
import { FeatureDeriverRegistry } from '../../services/feature-deriver.registry';
import type { EntityConfig } from '../../types';
import type { DatabaseService } from '@packages/database';

const testTable = pgTable('test_things', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  customFields: jsonb('custom_fields').notNull().default({}),
});

const tableWithoutCustomFields = pgTable('test_no_cf', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
});

function mockConfig(overrides: Partial<EntityConfig> = {}): EntityConfig {
  return {
    entityType: 'test_things',
    singularName: 'Thing',
    pluralName: 'Things',
    slug: 'things',
    table: testTable as any,
    systemColumns: ['id', 'customFields'],
    searchColumns: [],
    defaultSort: 'createdAt',
    sortableColumns: {},
    fieldMeta: {},
    sections: [],
    ui: { icon: 'box', nameField: 'name' },
    customFields: true,
    ...overrides,
  };
}

/**
 * Build a chainable query-builder mock where any terminal method resolves to `result`.
 */
function makeDbMock(result: any[] = []) {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

describe('JsonbStorageAdapter', () => {
  let registry: EntityRegistryService;

  beforeEach(() => {
    registry = new EntityRegistryService(new FeatureDeriverRegistry());
    registry.register(mockConfig());
  });

  describe('resolveTable', () => {
    it('throws when the entity table lacks a customFields column', async () => {
      const reg = new EntityRegistryService(new FeatureDeriverRegistry());
      reg.register(mockConfig({
        entityType: 'no_cf',
        slug: 'no-cf',
        table: tableWithoutCustomFields as any,
      }));

      const db = { db: makeDbMock() } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, reg);

      await expect(adapter.getValues('no_cf', 'abc')).rejects.toThrow(
        /lacks a customFields column/,
      );
    });

    it('throws when entity is not registered', async () => {
      const db = { db: makeDbMock() } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      await expect(adapter.getValues('unknown', 'abc')).rejects.toThrow(
        /not registered/,
      );
    });
  });

  describe('getValues', () => {
    it('returns an empty object when no row matches', async () => {
      const db = { db: makeDbMock([]) } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      expect(await adapter.getValues('test_things', 'abc')).toEqual({});
    });

    it('returns the customFields payload when the row exists', async () => {
      const db = { db: makeDbMock([{ customFields: { foo: 'bar', n: 42 } }]) } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      expect(await adapter.getValues('test_things', 'abc')).toEqual({ foo: 'bar', n: 42 });
    });

    it('coerces a null customFields column to an empty object', async () => {
      const db = { db: makeDbMock([{ customFields: null }]) } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      expect(await adapter.getValues('test_things', 'abc')).toEqual({});
    });
  });

  describe('getBatchValues', () => {
    it('returns an empty map for an empty id list without hitting the database', async () => {
      const db = { db: makeDbMock([]) } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const result = await adapter.getBatchValues('test_things', []);
      expect(result.size).toBe(0);
      expect(db.db.select).not.toHaveBeenCalled();
    });

    it('groups rows by id', async () => {
      const db = {
        db: makeDbMock([
          { id: 'a', customFields: { x: 1 } },
          { id: 'b', customFields: { y: 2 } },
        ]),
      } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const result = await adapter.getBatchValues('test_things', ['a', 'b']);
      expect(result.get('a')).toEqual({ x: 1 });
      expect(result.get('b')).toEqual({ y: 2 });
    });
  });

  describe('setValues', () => {
    it('merges new values with the existing payload', async () => {
      const mock = makeDbMock([{ customFields: { existing: 'keep' } }]);
      const db = { db: mock } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const { before, after } = await adapter.setValues('test_things', 'abc', { added: 'new' });

      expect(before).toEqual({ existing: 'keep' });
      expect(after).toEqual({ existing: 'keep', added: 'new' });
      expect(mock.update).toHaveBeenCalled();
      expect(mock.set).toHaveBeenCalledWith({ customFields: { existing: 'keep', added: 'new' } });
    });

    it('deletes a key when the value is null', async () => {
      const mock = makeDbMock([{ customFields: { keep: 1, drop: 2 } }]);
      const db = { db: mock } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const { after } = await adapter.setValues('test_things', 'abc', { drop: null });
      expect(after).toEqual({ keep: 1 });
    });

    it('deletes a key when the value is undefined or empty string', async () => {
      const mock = makeDbMock([{ customFields: { a: 1, b: 2, c: 3 } }]);
      const db = { db: mock } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const { after } = await adapter.setValues('test_things', 'abc', { a: undefined, b: '' });
      expect(after).toEqual({ c: 3 });
    });
  });

  describe('buildFilterCondition', () => {
    it('returns a true SQL node when no filters are supplied', () => {
      const db = { db: makeDbMock() } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const result = adapter.buildFilterCondition('test_things', testTable.id, []);
      expect(result).toBeDefined();
    });

    it('builds conditions for supported operators without throwing', () => {
      const db = { db: makeDbMock() } as unknown as DatabaseService;
      const adapter = new JsonbStorageAdapter(db, registry);

      const operators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'contains', 'in'] as const;
      for (const operator of operators) {
        const value = operator === 'in' ? ['a', 'b'] : 'value';
        expect(() =>
          adapter.buildFilterCondition('test_things', testTable.id, [
            { fieldKey: 'key', operator, value },
          ]),
        ).not.toThrow();
      }
    });
  });
});
