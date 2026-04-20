import { and, count, eq, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { SoftDeleteRestrictedError, type DependentDefinition, type SoftDeletePolicy } from './types';
import { hasSoftDeleteColumns } from './columns';

type AnyTable = Record<string, unknown>;

export interface SoftDeleteExecuteOptions {
  /** Optional WHERE fragment appended to every query (e.g. tenant filter). */
  scope?: SQL;
}

export interface SoftDeleteExecutor {
  delete(db: unknown, id: string, actorId: string, opts?: SoftDeleteExecuteOptions): Promise<void>;
  restore(db: unknown, id: string, actorId: string, opts?: SoftDeleteExecuteOptions): Promise<void>;
}

/**
 * Build an executor that runs the delete according to a soft-delete policy.
 *
 * The executor is intentionally tenancy-agnostic — callers that apply row-level
 * scoping (e.g. `@packages/tenancy`) can pass a `scope` SQL fragment that will
 * be ANDed onto every query the executor runs.
 *
 * Operation order (inside a single transaction):
 *   1. For every dependent with `strategy: 'restrict'` (or for every declared
 *      dependent when the policy's `mode === 'restrict'`), assert zero live
 *      rows. Throw `SoftDeleteRestrictedError` on first violation.
 *   2. Apply each dependent's strategy: `hardDelete`, `softDeleteCascade`, or
 *      `keep` (no-op). This runs BEFORE touching the parent row so FK-RESTRICT
 *      schemas don't block the parent delete.
 *   3. Delete the parent row per `mode` — hard DELETE, soft UPDATE with
 *      `deleted_at`/`deleted_by`, or hard DELETE for `restrict` (step 1 already
 *      verified dependents are clear).
 */
export function createSoftDeleteExecutor(policy: SoftDeletePolicy): SoftDeleteExecutor {
  return {
    delete: (db, id, actorId, opts) => executeDelete(db, policy, id, actorId, opts),
    restore: (db, id, actorId, opts) => executeRestore(db, policy, id, actorId, opts),
  };
}

interface TxLike {
  transaction<T>(fn: (tx: TxLike) => Promise<T>): Promise<T>;
  select: (...args: unknown[]) => any;
  update: (...args: unknown[]) => any;
  delete: (...args: unknown[]) => any;
}

async function executeDelete(
  db: unknown,
  policy: SoftDeletePolicy,
  id: string,
  actorId: string,
  opts?: SoftDeleteExecuteOptions,
): Promise<void> {
  const runner = db as TxLike;
  await runner.transaction(async (tx) => {
    await assertRestrictDependents(tx, policy, id, opts);
    await applyDependentStrategies(tx, policy, id, actorId, opts);
    await markParent(tx, policy, id, actorId, opts);
  });
}

async function executeRestore(
  db: unknown,
  policy: SoftDeletePolicy,
  id: string,
  actorId: string,
  opts?: SoftDeleteExecuteOptions,
): Promise<void> {
  if (policy.mode !== 'soft') {
    throw new Error(
      `createSoftDeleteExecutor().restore() is only supported for mode 'soft' (got '${policy.mode}')`,
    );
  }
  const runner = db as TxLike;
  await runner.transaction(async (tx) => {
    await tx
      .update(policy.table)
      .set({ deletedAt: null, deletedBy: null })
      .where(combine(eq(idColumn(policy.table), id), opts?.scope));

    for (const dep of policy.dependents ?? []) {
      if (dep.strategy === 'softDeleteCascade') {
        await tx
          .update(dep.table)
          .set({ deletedAt: null, deletedBy: null })
          .where(combine(eq(fkColumn(dep), id), opts?.scope));
      }
    }
    // Suppress unused-warning; actorId reserved for future audit-on-restore.
    void actorId;
  });
}

async function assertRestrictDependents(
  tx: TxLike,
  policy: SoftDeletePolicy,
  id: string,
  opts?: SoftDeleteExecuteOptions,
): Promise<void> {
  const mustCheckAll = policy.mode === 'restrict';
  for (const dep of policy.dependents ?? []) {
    const shouldCheck = mustCheckAll || dep.strategy === 'restrict';
    if (!shouldCheck) continue;

    const conditions: SQL[] = [eq(fkColumn(dep), id)];
    if (hasSoftDeleteColumns(dep.table)) {
      conditions.push(isNull((dep.table as unknown as AnyTable).deletedAt as never));
    }

    const whereClause = combine(and(...conditions)!, opts?.scope);
    const rows = await tx
      .select({ c: count() })
      .from(dep.table)
      .where(whereClause);
    const [{ c }] = rows as Array<{ c: number | string }>;
    if (Number(c) > 0) {
      throw new SoftDeleteRestrictedError(
        dep.restrictMessage ??
          `Cannot delete row: ${Number(c)} dependent row${Number(c) === 1 ? '' : 's'} exist on '${dep.foreignKey}'`,
      );
    }
  }
}

async function applyDependentStrategies(
  tx: TxLike,
  policy: SoftDeletePolicy,
  id: string,
  actorId: string,
  opts?: SoftDeleteExecuteOptions,
): Promise<void> {
  if (policy.mode === 'restrict') return;
  for (const dep of policy.dependents ?? []) {
    const fk = fkColumn(dep);
    if (dep.strategy === 'hardDelete') {
      await tx.delete(dep.table).where(combine(eq(fk, id), opts?.scope));
    } else if (dep.strategy === 'softDeleteCascade') {
      await tx
        .update(dep.table)
        .set({ deletedAt: new Date(), deletedBy: actorId })
        .where(combine(eq(fk, id), opts?.scope));
    }
    // 'keep' / 'restrict' → no-op (restrict was gated above).
  }
}

async function markParent(
  tx: TxLike,
  policy: SoftDeletePolicy,
  id: string,
  actorId: string,
  opts?: SoftDeleteExecuteOptions,
): Promise<void> {
  const where = combine(eq(idColumn(policy.table), id), opts?.scope);
  if (policy.mode === 'soft') {
    await tx
      .update(policy.table)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(where);
    return;
  }
  await tx.delete(policy.table).where(where);
}

function idColumn(table: unknown): any {
  const col = (table as AnyTable).id;
  if (!col) {
    throw new Error("soft-delete executor: table has no 'id' column");
  }
  return col;
}

function fkColumn(dep: DependentDefinition): any {
  const col = (dep.table as unknown as AnyTable)[dep.foreignKey];
  if (!col) {
    throw new Error(`soft-delete executor: foreign key '${dep.foreignKey}' not found on dependent table`);
  }
  return col;
}

function combine(base: SQL, scope: SQL | undefined): SQL {
  return scope ? (and(base, scope) as SQL) : base;
}
