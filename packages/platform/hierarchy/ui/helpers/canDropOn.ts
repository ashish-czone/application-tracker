import type { HierarchyRow } from './buildHierarchyRows';

/**
 * Returns true if `sourceId` can be reparented onto `targetId`.
 *
 * Rejects:
 * - Dropping onto itself
 * - Dropping onto a descendant (would create a cycle — the backend enforces
 *   this too, but catching it client-side keeps the UI honest)
 * - Unknown source id
 *
 * Accepts drops onto the current parent. The backend treats that as a no-op.
 */
export function canDropOn(
  sourceId: string,
  targetId: string | null,
  rows: HierarchyRow[],
): boolean {
  if (targetId === null) return true; // drop onto root
  if (sourceId === targetId) return false;
  const source = rows.find((r) => r.id === sourceId);
  if (!source) return false;
  if (source.descendantIds.has(targetId)) return false;
  return true;
}
