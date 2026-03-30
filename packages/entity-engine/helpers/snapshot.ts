import { isDeepStrictEqual } from 'node:util';

/**
 * Build a unified snapshot from standard column fields and EAV values.
 * Standard fields take precedence over EAV on key collision.
 */
export function buildSnapshot(
  standardFields: Record<string, unknown>,
  eavValues: Record<string, unknown>,
): Record<string, unknown> {
  return { ...eavValues, ...standardFields };
}

/**
 * Compute the list of keys whose values differ between two snapshots.
 * Handles primitives, Dates, arrays, null vs undefined, and new/removed keys.
 */
export function diffSnapshot(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...allKeys].filter(key => !isDeepStrictEqual(before[key], after[key]));
}
