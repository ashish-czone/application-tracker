import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * How an entity's own row is handled when deletion is requested.
 *
 * - `hard`  — physically DELETE the row. Default for most entities.
 * - `soft`  — UPDATE the row with `deleted_at`/`deleted_by`. Requires the
 *   table to spread `...softDeleteColumns()`.
 * - `restrict` — refuse deletion when any declared dependent has live rows;
 *   otherwise hard-delete. A safety valve for entities whose deletion would
 *   orphan important data.
 */
export type SoftDeleteMode = 'hard' | 'soft' | 'restrict';

/**
 * What to do with dependent rows that reference the entity being deleted.
 *
 * - `keep`              — do nothing; dependents remain untouched. Only
 *   meaningful for `mode: 'soft'` (hard-delete of the parent would
 *   orphan them at the FK level).
 * - `hardDelete`        — physically DELETE dependent rows in the same
 *   transaction. Useful for join-table rows (e.g. `user_roles`) that have
 *   no meaning without the parent.
 * - `softDeleteCascade` — UPDATE `deleted_at`/`deleted_by` on dependents.
 *   Requires the dependent table to spread `...softDeleteColumns()`.
 * - `restrict`          — refuse deletion when this specific dependent has
 *   live rows. Use when the UI should force the user to resolve this
 *   relationship before deletion is allowed.
 */
export type DependentStrategy =
  | 'keep'
  | 'hardDelete'
  | 'softDeleteCascade'
  | 'restrict';

/**
 * Declaration of a dependent relationship that the soft-delete executor should
 * handle when the parent row is deleted.
 */
export interface DependentDefinition {
  /** Drizzle table reference of the dependent. */
  table: PgTable;
  /** Column name on the dependent table that references the parent's id. */
  foreignKey: string;
  /** How this relationship is handled on parent deletion. */
  strategy: DependentStrategy;
  /** Error message shown when `strategy: 'restrict'` blocks deletion. */
  restrictMessage?: string;
}

/**
 * A resolved soft-delete policy. Produced by `defineSoftDeletePolicy()` and
 * consumed by `createSoftDeleteExecutor()`.
 */
export interface SoftDeletePolicy {
  table: PgTable;
  mode: SoftDeleteMode;
  dependents?: DependentDefinition[];
}

/**
 * Raised by `createSoftDeleteExecutor().delete()` when a dependent declared
 * with `strategy: 'restrict'` has live rows pointing at the row being deleted,
 * or when `mode: 'restrict'` and any declared dependent has live rows.
 *
 * Callers should translate this into a 409 Conflict at the HTTP boundary.
 */
export class SoftDeleteRestrictedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SoftDeleteRestrictedError';
  }
}
