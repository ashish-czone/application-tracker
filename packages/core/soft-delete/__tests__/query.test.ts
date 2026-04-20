import { describe, it, expect } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '../columns';
import { notDeleted, buildSoftDeleteCondition } from '../query';

const soft = pgTable('soft', {
  id: text('id').primaryKey(),
  ...softDeleteColumns(),
});

const hard = pgTable('hard', {
  id: text('id').primaryKey(),
});

describe('notDeleted', () => {
  it('returns a SQL fragment for a soft-deletable table', () => {
    const sql = notDeleted(soft);
    expect(sql).toBeTruthy();
    expect(typeof (sql as any).append === 'function' || typeof sql === 'object').toBe(true);
  });

  it('throws when the table has no deletedAt column', () => {
    expect(() => notDeleted(hard)).toThrow(/deletedAt/);
  });
});

describe('buildSoftDeleteCondition', () => {
  it('returns SQL for a soft-deletable table when includeDeleted is false', () => {
    expect(buildSoftDeleteCondition(soft, false)).toBeTruthy();
  });

  it('returns null when includeDeleted is true', () => {
    expect(buildSoftDeleteCondition(soft, true)).toBeNull();
  });

  it('returns null for a hard-delete table regardless of the flag', () => {
    expect(buildSoftDeleteCondition(hard, false)).toBeNull();
    expect(buildSoftDeleteCondition(hard, true)).toBeNull();
  });

  it('defaults includeDeleted to false', () => {
    expect(buildSoftDeleteCondition(soft)).toBeTruthy();
  });
});
