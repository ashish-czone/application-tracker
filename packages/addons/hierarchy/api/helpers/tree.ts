/**
 * Pure in-memory tree building from flat arrays.
 * No database dependency.
 */

export interface TreeBuildable {
  id: string;
  parentId: string | null;
}

export type WithChildren<T> = T & { children: WithChildren<T>[] };

/**
 * Build a tree from a flat array of items with parentId.
 * Items whose parentId doesn't exist in the array are treated as roots.
 *
 * @param items - Flat array of items (must have `id` and `parentId`)
 * @returns Array of root nodes with nested children
 */
export function buildTree<T extends TreeBuildable>(items: T[]): WithChildren<T>[] {
  const nodeMap = new Map<string, WithChildren<T>>();
  const roots: WithChildren<T>[] = [];

  // Create nodes with empty children arrays
  for (const item of items) {
    nodeMap.set(item.id, { ...item, children: [] });
  }

  // Wire parent → child relationships
  for (const item of items) {
    const node = nodeMap.get(item.id)!;
    if (item.parentId && nodeMap.has(item.parentId)) {
      nodeMap.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Flatten a tree back into an array (depth-first pre-order).
 */
export function flattenTree<T extends { children: T[] }>(roots: T[]): Omit<T, 'children'>[] {
  const result: Omit<T, 'children'>[] = [];

  function walk(nodes: T[]) {
    for (const node of nodes) {
      const { children, ...rest } = node;
      result.push(rest as Omit<T, 'children'>);
      walk(children);
    }
  }

  walk(roots);
  return result;
}