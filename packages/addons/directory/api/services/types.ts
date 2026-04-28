import type { DatabaseService, DrizzleTx } from '@packages/database';

/** Either a tx handle or the root db handle — services accept either. */
export type DbOrTx = DrizzleTx | DatabaseService['db'];

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

const MAX_MERGE_DEPTH = 16;

export async function followMerged<T extends { id: string; mergedIntoId: string | null }>(
  start: T,
  fetch: (id: string) => Promise<T | null>,
): Promise<T> {
  let current = start;
  for (let i = 0; i < MAX_MERGE_DEPTH; i += 1) {
    if (!current.mergedIntoId) return current;
    const next = await fetch(current.mergedIntoId);
    if (!next) return current; // dangling; return what we have
    current = next;
  }
  throw new Error(`merge chain exceeded depth ${MAX_MERGE_DEPTH} starting from ${start.id}`);
}
