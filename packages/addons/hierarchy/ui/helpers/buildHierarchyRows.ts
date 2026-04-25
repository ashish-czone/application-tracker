import { buildTree, type WithChildren } from '@packages/hierarchy';

export interface HierarchyRow {
  id: string;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  item: Record<string, unknown>;
  /** Set of all descendant ids for this row — used to reject drops into own subtree. */
  descendantIds: Set<string>;
}

interface Normalized {
  id: string;
  parentId: string | null;
  item: Record<string, unknown>;
}

/**
 * Flattens a list of hierarchical records into ordered rows for rendering.
 *
 * - Builds a tree from the flat list via parentId pointers (items whose parent
 *   is not present in the list become additional roots).
 * - Walks depth-first, preserving the input order within each sibling group.
 * - Skips descendants of any node whose id is in `collapsedIds` (the collapsed
 *   node itself is still emitted).
 * - Precomputes `descendantIds` per row so drag-to-reparent can cheaply reject
 *   drops into a node's own subtree.
 */
export function buildHierarchyRows(
  items: Array<Record<string, unknown>>,
  collapsedIds: Set<string>,
): HierarchyRow[] {
  const normalized: Normalized[] = items.map((item) => ({
    id: String(item.id),
    parentId: (item.parentId as string | null | undefined) ?? null,
    item,
  }));

  const tree = buildTree(normalized);
  const rows: HierarchyRow[] = [];

  function collectDescendants(node: WithChildren<Normalized>): Set<string> {
    const all = new Set<string>();
    for (const child of node.children) {
      all.add(child.id);
      for (const id of collectDescendants(child)) all.add(id);
    }
    return all;
  }

  function walk(nodes: WithChildren<Normalized>[], depth: number) {
    for (const node of nodes) {
      const collapsed = collapsedIds.has(node.id);
      rows.push({
        id: node.id,
        depth,
        hasChildren: node.children.length > 0,
        collapsed,
        item: node.item,
        descendantIds: collectDescendants(node),
      });
      if (!collapsed) walk(node.children, depth + 1);
    }
  }

  walk(tree, 0);
  return rows;
}
