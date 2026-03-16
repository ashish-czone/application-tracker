import { eq, ne, gt, lt, inArray, isNull, isNotNull, type SQL } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import type { Condition } from '../types';

/**
 * Converts JSON condition array into Drizzle SQL conditions.
 * Validates that each field exists in the allowed list.
 *
 * Returns an array of SQL conditions to be combined with `and()`.
 */
export function buildConditions(
  table: PgTableWithColumns<any>,
  conditions: Condition[],
  allowedFields: string[],
): SQL[] {
  const result: SQL[] = [];

  for (const condition of conditions) {
    if (!allowedFields.includes(condition.field)) {
      continue; // Skip unknown fields silently
    }

    const column = (table as Record<string, any>)[condition.field];
    if (!column) continue;

    switch (condition.operator) {
      case 'eq':
        result.push(eq(column, condition.value));
        break;
      case 'neq':
        result.push(ne(column, condition.value));
        break;
      case 'gt':
        result.push(gt(column, condition.value));
        break;
      case 'lt':
        result.push(lt(column, condition.value));
        break;
      case 'in':
        if (Array.isArray(condition.value)) {
          result.push(inArray(column, condition.value));
        }
        break;
      case 'is_null':
        result.push(isNull(column));
        break;
      case 'is_not_null':
        result.push(isNotNull(column));
        break;
    }
  }

  return result;
}
