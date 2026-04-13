export type WithChildren<T> = T & { children: WithChildren<T>[] };

export function buildTree<T extends { id: string; parentId: string | null }>(items: T[]): WithChildren<T>[] {
  const nodeMap = new Map<string, WithChildren<T>>();
  const roots: WithChildren<T>[] = [];

  for (const item of items) {
    nodeMap.set(item.id, { ...item, children: [] });
  }

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
