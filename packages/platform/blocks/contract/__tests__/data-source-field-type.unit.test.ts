import { describe, it, expect } from 'vitest';
import { dataSourceValidator, dataSourceFieldTypePlugin } from '../field-types';

const ctx = { label: 'Data Source' };

describe('dataSourceFieldTypePlugin', () => {
  it('exposes one field type registered as data_source under the blocks-contract plugin', () => {
    expect(dataSourceFieldTypePlugin.name).toBe('blocks-contract');
    expect(dataSourceFieldTypePlugin.fieldTypes).toHaveLength(1);
    const [ft] = dataSourceFieldTypePlugin.fieldTypes;
    expect(ft.type).toBe('data_source');
    expect(ft.storage).toEqual({ type: 'column' });
    expect(ft.creatable).toBe(false);
    expect(ft.filterable).toBe(false);
  });
});

describe('dataSourceValidator', () => {
  describe('rejects non-objects', () => {
    it.each([['string'], [42], [true], [null], [['a']]])('rejects %s', (value) => {
      const err = dataSourceValidator(value as unknown, ctx);
      expect(err?.code).toBe('type');
    });
  });

  it('accepts a static data source', () => {
    expect(dataSourceValidator({ kind: 'static' }, ctx)).toBeNull();
  });

  describe('entity-query', () => {
    it('accepts a minimal shape', () => {
      expect(
        dataSourceValidator({ kind: 'entity-query', entity: 'testimonials' }, ctx),
      ).toBeNull();
    });

    it('accepts filter, sort, limit', () => {
      expect(
        dataSourceValidator(
          { kind: 'entity-query', entity: 'testimonials', filter: { active: true }, sort: '-createdAt', limit: 5 },
          ctx,
        ),
      ).toBeNull();
    });

    it('rejects empty entity', () => {
      const err = dataSourceValidator({ kind: 'entity-query', entity: '' }, ctx);
      expect(err?.code).toBe('format');
    });

    it('rejects array filter', () => {
      const err = dataSourceValidator({ kind: 'entity-query', entity: 'x', filter: [] }, ctx);
      expect(err?.code).toBe('format');
    });

    it('rejects non-integer limit', () => {
      const err = dataSourceValidator({ kind: 'entity-query', entity: 'x', limit: 1.5 }, ctx);
      expect(err?.code).toBe('format');
    });

    it('rejects zero limit', () => {
      const err = dataSourceValidator({ kind: 'entity-query', entity: 'x', limit: 0 }, ctx);
      expect(err?.code).toBe('format');
    });
  });

  describe('entity-ids', () => {
    it('accepts an empty ids array', () => {
      expect(
        dataSourceValidator({ kind: 'entity-ids', entity: 'team', ids: [] }, ctx),
      ).toBeNull();
    });

    it('accepts a populated ids array', () => {
      expect(
        dataSourceValidator({ kind: 'entity-ids', entity: 'team', ids: ['a', 'b'] }, ctx),
      ).toBeNull();
    });

    it('rejects ids with non-string entries', () => {
      const err = dataSourceValidator({ kind: 'entity-ids', entity: 'x', ids: [1, 2] }, ctx);
      expect(err?.code).toBe('format');
    });

    it('rejects non-array ids', () => {
      const err = dataSourceValidator({ kind: 'entity-ids', entity: 'x', ids: 'a' }, ctx);
      expect(err?.code).toBe('format');
    });
  });

  it('rejects an unknown kind', () => {
    const err = dataSourceValidator({ kind: 'something' }, ctx);
    expect(err?.code).toBe('format');
  });
});
