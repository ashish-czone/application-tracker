import { Injectable, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, like, inArray, asc } from '@packages/database';
import {
  computePath,
  computeDepth,
  descendantPrefix,
  isDescendantOf,
  rebasePath,
} from '../helpers/path';

/**
 * Generic hierarchy operations for any Drizzle table that uses hierarchyColumns().
 *
 * Consumers inject this service and pass their table + column references.
 * The service handles path computation, cycle detection, and subtree moves.
 *
 * Usage:
 * ```
 * const ancestors = await this.hierarchyService.getAncestors(
 *   categories, categories.path, categories.id, category.path,
 * );
 * ```
 */
@Injectable()
export class HierarchyService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Compute path and depth for a new node being inserted.
   * Call this before inserting to get the values for path/depth columns.
   *
   * @param parentPath - The parent's path, or null for root nodes
   * @param nodeId - The new node's ID
   * @returns { path, depth } to set on the new row
   */
  computeInsertValues(parentPath: string | null, nodeId: string): { path: string; depth: number } {
    const path = computePath(parentPath, nodeId);
    const depth = computeDepth(path);
    return { path, depth };
  }

  /**
   * Get all ancestors of a node (excluding the node itself), ordered from root to parent.
   *
   * @param table - Drizzle table reference
   * @param idCol - The table's id column
   * @param pathCol - The table's path column
   * @param nodePath - The current node's path
   */
  async getAncestors<TTable extends Record<string, any>>(
    table: TTable,
    idCol: any,
    pathCol: any,
    nodePath: string,
  ): Promise<any[]> {
    const ancestorIds = nodePath.split('/').filter(Boolean).slice(0, -1);

    if (ancestorIds.length === 0) return [];

    const rows = await this.database.db
      .select()
      .from(table as any)
      .where(inArray(idCol, ancestorIds))
      .orderBy(asc(pathCol));

    return rows;
  }

  /**
   * Get all descendants of a node (excluding the node itself).
   *
   * @param table - Drizzle table reference
   * @param pathCol - The table's path column
   * @param nodePath - The current node's path
   */
  async getDescendants<TTable extends Record<string, any>>(
    table: TTable,
    pathCol: any,
    nodePath: string,
  ): Promise<any[]> {
    const prefix = descendantPrefix(nodePath);

    return this.database.db
      .select()
      .from(table as any)
      .where(like(pathCol, prefix));
  }

  /**
   * Move a node (and its entire subtree) to a new parent.
   * Handles cycle detection and updates all descendant paths.
   *
   * @param table - Drizzle table reference
   * @param idCol - The table's id column
   * @param parentIdCol - The table's parentId column
   * @param pathCol - The table's path column
   * @param depthCol - The table's depth column
   * @param nodeId - The ID of the node being moved
   * @param nodePath - The current path of the node being moved
   * @param newParentId - The new parent ID, or null to make it a root
   * @param newParentPath - The new parent's path, or null for root
   */
  async move(
    table: any,
    idCol: any,
    parentIdCol: any,
    pathCol: any,
    depthCol: any,
    nodeId: string,
    nodePath: string,
    newParentId: string | null,
    newParentPath: string | null,
  ): Promise<void> {
    // Prevent self-parenting
    if (newParentId === nodeId) {
      throw new ConflictException('A node cannot be its own parent');
    }

    // Prevent cycles: new parent must not be a descendant of the node being moved
    if (newParentId && newParentPath && isDescendantOf(newParentPath, nodePath)) {
      throw new ConflictException('Moving this node would create a cycle');
    }

    const oldPath = nodePath;
    const newPath = computePath(newParentPath, nodeId);
    const newDepth = computeDepth(newPath);

    // Wrap in a transaction to prevent concurrent moves from corrupting paths
    await this.database.db.transaction(async (tx) => {
      // Update the node itself
      await tx
        .update(table)
        .set({
          parentId: newParentId,
          path: newPath,
          depth: newDepth,
        })
        .where(eq(idCol, nodeId));

      // Update all descendants: replace old path prefix with new path prefix
      const descendants = await tx
        .select()
        .from(table as any)
        .where(like(pathCol, descendantPrefix(oldPath)));

      for (const descendant of descendants) {
        const updatedPath = rebasePath(descendant.path, oldPath, newPath);
        const updatedDepth = computeDepth(updatedPath);

        await tx
          .update(table)
          .set({ path: updatedPath, depth: updatedDepth })
          .where(eq(idCol, descendant.id));
      }
    });
  }

  /**
   * Backfill path and depth for all rows in a table that uses adjacency list only.
   * Useful for migrating existing tables to materialized paths.
   *
   * Processes rows level by level starting from roots (parentId IS NULL).
   *
   * @param table - Drizzle table reference
   * @param idCol - The table's id column
   * @param parentIdCol - The table's parentId column
   * @param pathCol - The table's path column
   * @param depthCol - The table's depth column
   */
  async backfillPaths(
    table: any,
    idCol: any,
    parentIdCol: any,
    pathCol: any,
    depthCol: any,
  ): Promise<number> {
    // Fetch all rows
    const allRows = await this.database.db.select().from(table as any);

    const rowMap = new Map<string, any>();
    for (const row of allRows) {
      rowMap.set(row.id, row);
    }

    let updated = 0;

    // Compute path for each row by walking up the parent chain
    for (const row of allRows) {
      const pathSegments: string[] = [];
      let current = row;

      while (current) {
        pathSegments.unshift(current.id);
        if (current.parentId) {
          current = rowMap.get(current.parentId);
        } else {
          break;
        }
      }

      const path = '/' + pathSegments.join('/');
      const depth = pathSegments.length - 1;

      await this.database.db
        .update(table)
        .set({ path, depth })
        .where(eq(idCol, row.id));

      updated++;
    }

    return updated;
  }
}