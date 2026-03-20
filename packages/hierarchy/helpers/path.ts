/**
 * Pure helper functions for materialized path operations.
 * No database dependency — these work on path strings only.
 */

/** Separator used in materialized paths */
const SEP = '/';

/**
 * Compute the materialized path for a node.
 * @param parentPath - The parent's path (or null/undefined for root nodes)
 * @param id - This node's ID
 * @returns The full path string, e.g. "/parent-id/this-id"
 */
export function computePath(parentPath: string | null | undefined, id: string): string {
  if (!parentPath || parentPath === SEP) {
    return `${SEP}${id}`;
  }
  return `${parentPath}${SEP}${id}`;
}

/**
 * Compute the depth from a path string.
 * Root nodes (path = "/id") have depth 0.
 */
export function computeDepth(path: string): number {
  // Count separators minus the leading one, minus 1 for the node itself
  const segments = path.split(SEP).filter(Boolean);
  return Math.max(0, segments.length - 1);
}

/**
 * Extract ancestor IDs from a path (excludes the node itself).
 * e.g. "/a/b/c" → ["a", "b"]
 */
export function extractAncestorIds(path: string): string[] {
  const segments = path.split(SEP).filter(Boolean);
  return segments.slice(0, -1);
}

/**
 * Extract the node's own ID from its path (last segment).
 * e.g. "/a/b/c" → "c"
 */
export function extractNodeId(path: string): string {
  const segments = path.split(SEP).filter(Boolean);
  return segments[segments.length - 1];
}

/**
 * Compute the new path for a node after it has been moved.
 * Replaces the old prefix with the new parent's path.
 *
 * @param oldPath - The node's current path
 * @param oldParentPath - The old parent's path (prefix to replace)
 * @param newParentPath - The new parent's path (new prefix)
 * @returns Updated path
 */
export function rebasePath(
  oldPath: string,
  oldParentPath: string,
  newParentPath: string | null,
): string {
  const suffix = oldPath.slice(oldParentPath.length);
  if (!newParentPath || newParentPath === SEP) {
    return suffix;
  }
  return `${newParentPath}${suffix}`;
}

/**
 * Check if a path is a descendant of another path.
 * e.g. isDescendantOf("/a/b/c", "/a/b") → true
 */
export function isDescendantOf(path: string, ancestorPath: string): boolean {
  return path.startsWith(ancestorPath + SEP);
}

/**
 * Build a prefix pattern for finding all descendants of a path.
 * Used in SQL LIKE queries: WHERE path LIKE '/a/b/%'
 */
export function descendantPrefix(path: string): string {
  return `${path}${SEP}%`;
}