export { HierarchyModule } from './hierarchy.module';

export const hierarchyAddon = {
  module: () => require('./hierarchy.module').HierarchyModule,
  migration: '@packages/hierarchy',
} as const;
export { HierarchyService } from './services/hierarchy.service';
export { hierarchyColumns } from './schema';
export { buildTree, flattenTree } from './helpers/tree';
export type { WithChildren, TreeBuildable } from './helpers/tree';
export {
  computePath,
  computeDepth,
  extractAncestorIds,
  extractNodeId,
  rebasePath,
  isDescendantOf,
  descendantPrefix,
} from './helpers/path';
export type { HierarchyNode, TreeNode, HierarchyTableConfig } from './types';