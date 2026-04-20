import type { ResolvedExtension } from '../types';

export interface SplitExtensionResult {
  /** Fields that live on the parent's table (projected columns). */
  parentFields: Record<string, unknown>;
  /** Fields that live on the child's own table. */
  childFields: Record<string, unknown>;
}

/**
 * For an extension entity (`extensionOf`), split a bucket of standard-column
 * writes into the slice that belongs on the parent table vs. the slice that
 * belongs on the child table.
 *
 * The projection contract (`ext.projectedColumns`) is the single source of
 * truth: any key projected from the parent is a parent write, everything else
 * stays with the child. Callers typically pass the `standardFields` bucket
 * produced by `splitPayload` — EAV and relational writes are always child-side
 * so they don't need to be split here.
 */
export function splitExtensionPayload(
  standardFields: Record<string, unknown>,
  ext: ResolvedExtension,
): SplitExtensionResult {
  const projectedKeys = new Set(ext.projectedColumns.map(c => c.fieldKey));
  const parentFields: Record<string, unknown> = {};
  const childFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(standardFields)) {
    if (projectedKeys.has(key)) {
      parentFields[key] = value;
    } else {
      childFields[key] = value;
    }
  }

  return { parentFields, childFields };
}
