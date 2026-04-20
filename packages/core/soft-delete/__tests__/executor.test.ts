import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '../columns';
import { createSoftDeleteExecutor } from '../executor';
import { SoftDeleteRestrictedError } from '../types';

/**
 * Unit tests exercise the executor against a recording fake db. They assert
 * the operation ORDER and SHAPE (select/update/delete calls on the right
 * tables). End-to-end DB behavior is covered by entity-engine integration
 * tests once this package is wired in.
 */

const parentSoft = pgTable('parent_soft', {
  id: text('id').primaryKey(),
  ...softDeleteColumns(),
});

const parentHard = pgTable('parent_hard', {
  id: text('id').primaryKey(),
});

const childHard = pgTable('child_hard', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
});

const childSoft = pgTable('child_soft', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  ...softDeleteColumns(),
});

type Call =
  | { kind: 'select'; table: unknown; rows: Array<{ c: number }> }
  | { kind: 'update'; table: unknown; values: Record<string, unknown> }
  | { kind: 'delete'; table: unknown };

function createFakeDb(selectReturns: Array<Array<{ c: number }>> = []) {
  const calls: Call[] = [];
  let selectIdx = 0;

  function selectChain() {
    let fromTable: unknown = null;
    return {
      from(table: unknown) {
        fromTable = table;
        return this;
      },
      where() {
        const rows = selectReturns[selectIdx++] ?? [{ c: 0 }];
        calls.push({ kind: 'select', table: fromTable, rows });
        return Promise.resolve(rows);
      },
    };
  }

  function updateChain(table: unknown) {
    let values: Record<string, unknown> = {};
    return {
      set(v: Record<string, unknown>) {
        values = v;
        return this;
      },
      where() {
        calls.push({ kind: 'update', table, values });
        return Promise.resolve();
      },
    };
  }

  function deleteChain(table: unknown) {
    return {
      where() {
        calls.push({ kind: 'delete', table });
        return Promise.resolve();
      },
    };
  }

  const tx = {
    select: () => selectChain(),
    update: (table: unknown) => updateChain(table),
    delete: (table: unknown) => deleteChain(table),
    transaction: async <T>(fn: (tx: typeof tx) => Promise<T>) => fn(tx),
  };
  return { tx, calls };
}

describe('createSoftDeleteExecutor — delete', () => {
  let now: Date;
  beforeEach(() => {
    now = new Date('2026-04-20T00:00:00Z');
    vi.setSystemTime(now);
  });

  it('soft-deletes the parent row (mode: soft, no dependents)', async () => {
    const executor = createSoftDeleteExecutor({ table: parentSoft, mode: 'soft' });
    const { tx, calls } = createFakeDb();

    await executor.delete(tx, 'parent-1', 'actor-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'update', table: parentSoft });
    expect((calls[0] as any).values.deletedAt).toEqual(now);
    expect((calls[0] as any).values.deletedBy).toBe('actor-1');
  });

  it('hard-deletes the parent row (mode: hard)', async () => {
    const executor = createSoftDeleteExecutor({ table: parentHard, mode: 'hard' });
    const { tx, calls } = createFakeDb();

    await executor.delete(tx, 'parent-1', 'actor-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'delete', table: parentHard });
  });

  it('applies hardDelete strategy to dependents before soft-deleting parent', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentSoft,
      mode: 'soft',
      dependents: [{ table: childHard, foreignKey: 'parentId', strategy: 'hardDelete' }],
    });
    const { tx, calls } = createFakeDb();

    await executor.delete(tx, 'parent-1', 'actor-1');

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ kind: 'delete', table: childHard });
    expect(calls[1]).toMatchObject({ kind: 'update', table: parentSoft });
  });

  it('applies softDeleteCascade strategy to dependents', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentSoft,
      mode: 'soft',
      dependents: [{ table: childSoft, foreignKey: 'parentId', strategy: 'softDeleteCascade' }],
    });
    const { tx, calls } = createFakeDb();

    await executor.delete(tx, 'parent-1', 'actor-1');

    expect(calls[0]).toMatchObject({ kind: 'update', table: childSoft });
    expect((calls[0] as any).values.deletedAt).toEqual(now);
    expect(calls[1]).toMatchObject({ kind: 'update', table: parentSoft });
  });

  it('ignores keep strategy (no-op on dependents)', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentSoft,
      mode: 'soft',
      dependents: [{ table: childSoft, foreignKey: 'parentId', strategy: 'keep' }],
    });
    const { tx, calls } = createFakeDb();

    await executor.delete(tx, 'parent-1', 'actor-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'update', table: parentSoft });
  });

  it('throws SoftDeleteRestrictedError when a restrict dependent has live rows', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentSoft,
      mode: 'soft',
      dependents: [
        {
          table: childHard,
          foreignKey: 'parentId',
          strategy: 'restrict',
          restrictMessage: 'Reassign children first',
        },
      ],
    });
    const first = createFakeDb([[{ c: 3 }]]);
    await expect(executor.delete(first.tx, 'parent-1', 'actor-1')).rejects.toBeInstanceOf(
      SoftDeleteRestrictedError,
    );
    const second = createFakeDb([[{ c: 3 }]]);
    await expect(executor.delete(second.tx, 'parent-1', 'actor-1')).rejects.toThrow(
      'Reassign children first',
    );
  });

  it('proceeds when a restrict dependent has zero live rows', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentSoft,
      mode: 'soft',
      dependents: [{ table: childHard, foreignKey: 'parentId', strategy: 'restrict' }],
    });
    const { tx, calls } = createFakeDb([[{ c: 0 }]]);

    await executor.delete(tx, 'parent-1', 'actor-1');

    const mutations = calls.filter((c) => c.kind !== 'select');
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({ kind: 'update', table: parentSoft });
  });

  it('mode: restrict checks all declared dependents regardless of their strategy', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentHard,
      mode: 'restrict',
      dependents: [
        { table: childHard, foreignKey: 'parentId', strategy: 'hardDelete' },
      ],
    });
    const { tx } = createFakeDb([[{ c: 1 }]]);

    await expect(executor.delete(tx, 'parent-1', 'actor-1')).rejects.toBeInstanceOf(
      SoftDeleteRestrictedError,
    );
  });

  it('mode: restrict hard-deletes when all declared dependents are clear', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentHard,
      mode: 'restrict',
      dependents: [
        { table: childHard, foreignKey: 'parentId', strategy: 'hardDelete' },
      ],
    });
    const { tx, calls } = createFakeDb([[{ c: 0 }]]);

    await executor.delete(tx, 'parent-1', 'actor-1');

    const mutations = calls.filter((c) => c.kind !== 'select');
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({ kind: 'delete', table: parentHard });
  });
});

describe('createSoftDeleteExecutor — restore', () => {
  it('clears deletedAt / deletedBy on the parent row (mode: soft)', async () => {
    const executor = createSoftDeleteExecutor({ table: parentSoft, mode: 'soft' });
    const { tx, calls } = createFakeDb();

    await executor.restore(tx, 'parent-1', 'actor-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'update', table: parentSoft });
    expect((calls[0] as any).values).toEqual({ deletedAt: null, deletedBy: null });
  });

  it('cascades restore to softDeleteCascade dependents', async () => {
    const executor = createSoftDeleteExecutor({
      table: parentSoft,
      mode: 'soft',
      dependents: [{ table: childSoft, foreignKey: 'parentId', strategy: 'softDeleteCascade' }],
    });
    const { tx, calls } = createFakeDb();

    await executor.restore(tx, 'parent-1', 'actor-1');

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ kind: 'update', table: parentSoft });
    expect(calls[1]).toMatchObject({ kind: 'update', table: childSoft });
  });

  it('refuses to restore a hard-delete policy', async () => {
    const executor = createSoftDeleteExecutor({ table: parentHard, mode: 'hard' });
    const { tx } = createFakeDb();

    await expect(executor.restore(tx, 'parent-1', 'actor-1')).rejects.toThrow(/only supported for mode 'soft'/);
  });
});
