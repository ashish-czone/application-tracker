/** A flat record that has hierarchy columns */
export interface HierarchyNode {
  id: string;
  parentId: string | null;
  path: string;
  depth: number;
}

/** A node with nested children — returned by buildTree */
export interface TreeNode<T> extends Record<string, unknown> {
  id: string;
  children: TreeNode<T>[];
}

/** Configuration for hierarchy operations on a specific table */
export interface HierarchyTableConfig {
  /** The Drizzle table reference */
  table: any;
  /** Column references — defaults assume standard hierarchyColumns names */
  columns?: {
    id?: any;
    parentId?: any;
    path?: any;
    depth?: any;
  };
}