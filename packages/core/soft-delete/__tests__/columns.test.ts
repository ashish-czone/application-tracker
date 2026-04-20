import { describe, it, expect } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { softDeleteColumns, hasSoftDeleteColumns } from '../columns';

describe('softDeleteColumns', () => {
  it('returns an object with deletedAt and deletedBy columns', () => {
    const cols = softDeleteColumns();
    expect(cols).toHaveProperty('deletedAt');
    expect(cols).toHaveProperty('deletedBy');
  });

  it('integrates into pgTable via spread', () => {
    const widgets = pgTable('widgets', {
      id: text('id').primaryKey(),
      ...softDeleteColumns(),
    });
    expect((widgets as any).deletedAt).toBeTruthy();
    expect((widgets as any).deletedBy).toBeTruthy();
  });
});

describe('hasSoftDeleteColumns', () => {
  it('returns true when both columns exist', () => {
    const t = pgTable('t1', {
      id: text('id').primaryKey(),
      ...softDeleteColumns(),
    });
    expect(hasSoftDeleteColumns(t)).toBe(true);
  });

  it('returns false when columns are missing', () => {
    const t = pgTable('t2', { id: text('id').primaryKey() });
    expect(hasSoftDeleteColumns(t)).toBe(false);
  });

  it('returns false when only one of the two columns exists', () => {
    const t = pgTable('t3', {
      id: text('id').primaryKey(),
      deletedAt: text('deleted_at'),
    });
    expect(hasSoftDeleteColumns(t)).toBe(false);
  });
});
