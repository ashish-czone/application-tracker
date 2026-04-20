import type { PgTable } from 'drizzle-orm/pg-core';
import { hasSoftDeleteColumns } from './columns';
import type {
  DependentDefinition,
  SoftDeleteMode,
  SoftDeletePolicy,
} from './types';

export interface DefineSoftDeletePolicyInput {
  table: PgTable;
  mode: SoftDeleteMode;
  dependents?: DependentDefinition[];
}

/**
 * Build and validate a soft-delete policy for a Drizzle table.
 *
 * Fails fast when:
 * - `mode: 'soft'` but the table does not spread `...softDeleteColumns()`.
 * - `mode: 'hard' | 'restrict'` but the table DOES have soft-delete columns
 *   (likely a mistake — the columns would never be read or written).
 * - A dependent declared with `strategy: 'softDeleteCascade'` is missing
 *   soft-delete columns.
 */
export function defineSoftDeletePolicy(
  input: DefineSoftDeletePolicyInput,
): SoftDeletePolicy {
  const { table, mode, dependents } = input;

  if (mode === 'soft' && !hasSoftDeleteColumns(table)) {
    throw new Error(
      `defineSoftDeletePolicy: mode 'soft' requires the table to spread ...softDeleteColumns(). ` +
        `Missing deletedAt / deletedBy columns on the target table.`,
    );
  }

  if (mode !== 'soft' && hasSoftDeleteColumns(table)) {
    throw new Error(
      `defineSoftDeletePolicy: mode '${mode}' is incompatible with a table that has ` +
        `soft-delete columns. Either switch to mode 'soft' or drop ...softDeleteColumns() from the table.`,
    );
  }

  for (const dep of dependents ?? []) {
    if (dep.strategy === 'softDeleteCascade' && !hasSoftDeleteColumns(dep.table)) {
      throw new Error(
        `defineSoftDeletePolicy: dependent with strategy 'softDeleteCascade' requires the dependent ` +
          `table to spread ...softDeleteColumns().`,
      );
    }
    if (!(dep.table as unknown as Record<string, unknown>)[dep.foreignKey]) {
      throw new Error(
        `defineSoftDeletePolicy: foreign key '${dep.foreignKey}' not found on dependent table.`,
      );
    }
  }

  return { table, mode, dependents };
}
