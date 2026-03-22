import { eq, ne, gt, lt, inArray, isNull, isNotNull, type SQL } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
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
