import type { MenuItemRecord } from './types';

export interface MenuItemNode extends MenuItemRecord {
  children: MenuItemNode[];
}

/**
 * Build a 2-level tree from a flat list of menu items, in sortOrder within
 * each level. Orphaned children surface at the root rather than being
 * silently dropped — same posture as the backend buildMenuTree helper.
 */
export function buildMenuItemTree(items: MenuItemRecord[]): MenuItemNode[] {
  const sorted = [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });

  const byId = new Map<string, MenuItemNode>();
  for (const item of sorted) {
    byId.set(item.id, { ...item, children: [] });
  }

  const roots: MenuItemNode[] = [];
  for (const item of sorted) {
    const node = byId.get(item.id)!;
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Compute the sortOrder value needed to drop an item at a given index
 * within a sibling list. Uses a simple midpoint strategy so ordinary
 * reorders don't require rewriting every sibling's sortOrder. Returns the
 * new sortOrder for the moved item; callers are responsible for the PATCH.
 */
export function computeSortOrderForIndex(
  siblings: { id: string; sortOrder: number }[],
  targetIndex: number,
  movingId?: string,
): number {
  const filtered = siblings.filter((s) => s.id !== movingId);
  const clamped = Math.max(0, Math.min(targetIndex, filtered.length));
  const prev = clamped > 0 ? filtered[clamped - 1] : null;
  const next = clamped < filtered.length ? filtered[clamped] : null;

  if (!prev && !next) return 1000;
  if (!prev) return next!.sortOrder - 1000;
  if (!next) return prev.sortOrder + 1000;
  return Math.floor((prev.sortOrder + next.sortOrder) / 2);
}
