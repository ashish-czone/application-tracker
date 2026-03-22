import { eq, ne, gt, lt, inArray, isNull, isNotNull, sql, type SQL } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { entityFieldValues } from '@packages/eav-attributes/schema';
import type { Condition } from '../types';

const PAYLOAD_OPERATORS = ['changed', 'changed_to', 'changed_from_to'] as const;

/**
 * Check if a condition uses payload-based operators.
 * Payload conditions are evaluated in-memory against event payloads,
 * not translated to SQL.
 */
export function isPayloadCondition(condition: Condition): boolean {
  return (PAYLOAD_OPERATORS as readonly string[]).includes(condition.operator);
}

/**
 * Evaluate payload-based conditions against event payload.
 * Returns true if all payload conditions pass (or if there are none).
 */
export function evaluatePayloadConditions(
  conditions: Condition[],
  payload: { changes?: string[]; before?: Record<string, unknown>; after?: Record<string, unknown> },
): boolean {
  const payloadConditions = conditions.filter(isPayloadCondition);
  if (payloadConditions.length === 0) return true;

  return payloadConditions.every((c) => {
    switch (c.operator) {
      case 'changed':
        return payload.changes?.includes(c.field) ?? false;
      case 'changed_to':
        return (payload.changes?.includes(c.field) ?? false) &&
               payload.after?.[c.field] === c.value;
      case 'changed_from_to': {
        const val = c.value as { from: unknown; to: unknown } | undefined;
        return (payload.changes?.includes(c.field) ?? false) &&
               payload.before?.[c.field] === val?.from &&
               payload.after?.[c.field] === val?.to;
      }
      default:
        return false;
    }
  });
}

/**
 * Evaluate state-based conditions in-memory against a flat entity object.
 * Returns true if all state conditions pass (or if there are none).
 */
export function evaluateConditionsInMemory(
  conditions: Condition[],
  entity: Record<string, unknown>,
): boolean {
  const stateConditions = conditions.filter((c) => !isPayloadCondition(c));
  if (stateConditions.length === 0) return true;

  return stateConditions.every((c) => {
    const value = entity[c.field];
    switch (c.operator) {
      case 'eq': return value === c.value;
      case 'neq': return value !== c.value;
      case 'gt': return typeof value === 'number' && typeof c.value === 'number' && value > c.value;
      case 'lt': return typeof value === 'number' && typeof c.value === 'number' && value < c.value;
      case 'in': return Array.isArray(c.value) && c.value.includes(value);
      case 'is_null': return value === null || value === undefined;
      case 'is_not_null': return value !== null && value !== undefined;
      default: return true; // Unknown operators pass (don't block)
    }
  });
}

/**
 * Converts JSON condition array into Drizzle SQL conditions.
 * Validates that each field exists in the allowed list.
 * Payload-based operators (changed, changed_to, changed_from_to) are
 * automatically filtered out — they cannot be translated to SQL.
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
    // Skip payload-based operators — they are evaluated in-memory
    if (isPayloadCondition(condition)) continue;

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

/**
 * Determine which typed value column to compare against based on the JS value type.
 */
function getEavValueColumn(value: unknown): string {
  if (typeof value === 'number') return 'efv.value_number';
  if (typeof value === 'boolean') return 'efv.value_boolean';
  if (value instanceof Date) return 'efv.value_date';
  return 'efv.value_text'; // default to text for strings and unknowns
}

/**
 * Coerce a JS value to the appropriate SQL parameter type for EAV comparisons.
 */
function coerceEavValue(value: unknown): string | number | boolean {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  return String(value);
}

/**
 * Builds EXISTS subquery conditions for EAV (custom) fields.
 * Used when a condition field is not a standard column on the entity table.
 *
 * Each condition generates an EXISTS (or NOT EXISTS for is_null) subquery
 * against the entity_field_values table. These can be AND'd with standard
 * column conditions in the main entity query.
 *
 * Follows the same raw SQL EXISTS pattern used in FieldValueService.buildFilterCondition.
 */
export function buildEavConditions(
  entityType: string,
  entityIdColumn: any,
  conditions: Condition[],
): SQL[] {
  const result: SQL[] = [];

  for (const condition of conditions) {
    // Skip payload-based operators
    if (isPayloadCondition(condition)) continue;

    const fieldKey = condition.field;

    switch (condition.operator) {
      case 'eq': {
        const col = getEavValueColumn(condition.value);
        const val = coerceEavValue(condition.value!);
        result.push(sql`EXISTS (
          SELECT 1 FROM entity_field_values efv
          WHERE efv.entity_type = ${entityType}
            AND efv.entity_id = ${entityIdColumn}
            AND efv.field_key = ${fieldKey}
            AND ${sql.raw(col)} = ${val}
        )`);
        break;
      }
      case 'neq': {
        const col = getEavValueColumn(condition.value);
        const val = coerceEavValue(condition.value!);
        result.push(sql`EXISTS (
          SELECT 1 FROM entity_field_values efv
          WHERE efv.entity_type = ${entityType}
            AND efv.entity_id = ${entityIdColumn}
            AND efv.field_key = ${fieldKey}
            AND ${sql.raw(col)} != ${val}
        )`);
        break;
      }
      case 'gt': {
        if (typeof condition.value === 'number') {
          result.push(sql`EXISTS (
            SELECT 1 FROM entity_field_values efv
            WHERE efv.entity_type = ${entityType}
              AND efv.entity_id = ${entityIdColumn}
              AND efv.field_key = ${fieldKey}
              AND efv.value_number > ${condition.value}
          )`);
        }
        break;
      }
      case 'lt': {
        if (typeof condition.value === 'number') {
          result.push(sql`EXISTS (
            SELECT 1 FROM entity_field_values efv
            WHERE efv.entity_type = ${entityType}
              AND efv.entity_id = ${entityIdColumn}
              AND efv.field_key = ${fieldKey}
              AND efv.value_number < ${condition.value}
          )`);
        }
        break;
      }
      case 'in': {
        if (Array.isArray(condition.value)) {
          const placeholders = condition.value.map((v: unknown) => sql`${String(v)}`);
          result.push(sql`EXISTS (
            SELECT 1 FROM entity_field_values efv
            WHERE efv.entity_type = ${entityType}
              AND efv.entity_id = ${entityIdColumn}
              AND efv.field_key = ${fieldKey}
              AND efv.value_text IN (${sql.join(placeholders, sql`, `)})
          )`);
        }
        break;
      }
      case 'is_null': {
        // EAV field is null = no row exists for this field key
        result.push(sql`NOT EXISTS (
          SELECT 1 FROM entity_field_values efv
          WHERE efv.entity_type = ${entityType}
            AND efv.entity_id = ${entityIdColumn}
            AND efv.field_key = ${fieldKey}
        )`);
        break;
      }
      case 'is_not_null': {
        // EAV field is not null = a row exists for this field key
        result.push(sql`EXISTS (
          SELECT 1 FROM entity_field_values efv
          WHERE efv.entity_type = ${entityType}
            AND efv.entity_id = ${entityIdColumn}
            AND efv.field_key = ${fieldKey}
        )`);
        break;
      }
    }
  }

  return result;
}
