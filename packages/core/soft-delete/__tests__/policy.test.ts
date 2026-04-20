import { describe, it, expect } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '../columns';
import { defineSoftDeletePolicy } from '../policy';

const softTable = pgTable('soft', {
  id: text('id').primaryKey(),
  ...softDeleteColumns(),
});

const hardTable = pgTable('hard', {
  id: text('id').primaryKey(),
});

const childSoft = pgTable('child_soft', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  ...softDeleteColumns(),
});

const childHard = pgTable('child_hard', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
});

describe('defineSoftDeletePolicy', () => {
  it('accepts a soft policy on a table with soft-delete columns', () => {
    const policy = defineSoftDeletePolicy({ table: softTable, mode: 'soft' });
    expect(policy.mode).toBe('soft');
    expect(policy.table).toBe(softTable);
  });

  it('accepts a hard policy on a table without soft-delete columns', () => {
    const policy = defineSoftDeletePolicy({ table: hardTable, mode: 'hard' });
    expect(policy.mode).toBe('hard');
  });

  it('accepts a restrict policy on a table without soft-delete columns', () => {
    const policy = defineSoftDeletePolicy({ table: hardTable, mode: 'restrict' });
    expect(policy.mode).toBe('restrict');
  });

  it('rejects soft mode when the table has no soft-delete columns', () => {
    expect(() =>
      defineSoftDeletePolicy({ table: hardTable, mode: 'soft' }),
    ).toThrow(/softDeleteColumns/);
  });

  it('rejects hard mode when the table has soft-delete columns', () => {
    expect(() =>
      defineSoftDeletePolicy({ table: softTable, mode: 'hard' }),
    ).toThrow(/incompatible/);
  });

  it('rejects restrict mode when the table has soft-delete columns', () => {
    expect(() =>
      defineSoftDeletePolicy({ table: softTable, mode: 'restrict' }),
    ).toThrow(/incompatible/);
  });

  it('accepts a softDeleteCascade dependent when the dependent has soft-delete columns', () => {
    const policy = defineSoftDeletePolicy({
      table: softTable,
      mode: 'soft',
      dependents: [
        { table: childSoft, foreignKey: 'parentId', strategy: 'softDeleteCascade' },
      ],
    });
    expect(policy.dependents).toHaveLength(1);
  });

  it('rejects a softDeleteCascade dependent when the dependent has no soft-delete columns', () => {
    expect(() =>
      defineSoftDeletePolicy({
        table: softTable,
        mode: 'soft',
        dependents: [
          { table: childHard, foreignKey: 'parentId', strategy: 'softDeleteCascade' },
        ],
      }),
    ).toThrow(/softDeleteCascade/);
  });

  it('rejects a dependent with an unknown foreign key', () => {
    expect(() =>
      defineSoftDeletePolicy({
        table: softTable,
        mode: 'soft',
        dependents: [
          { table: childHard, foreignKey: 'missing', strategy: 'hardDelete' },
        ],
      }),
    ).toThrow(/foreign key 'missing'/);
  });
});
