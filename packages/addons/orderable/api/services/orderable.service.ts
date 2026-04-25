import { Injectable } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';

/**
 * Generic sibling-ordering operations for any Drizzle table that uses
 * orderableColumns(). Consumers inject this service and pass their table
 * + column references. The service writes absolute sort_order values.
 *
 * Absolute (not relative) ordering: the caller picks the integer and the
 * service writes it. List queries are expected to sort by `sort_order ASC,
 * id ASC` to keep ordering stable when multiple rows collide on the same
 * value.
 *
 * Usage:
 * ```
 * await this.orderableService.setSortOrder(menuItems, menuItems.id, menuItems.sortOrder, id, 1024);
 * ```
 */
@Injectable()
export class OrderableService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Set a row's sort_order to an absolute value.
   *
   * @param table - Drizzle table reference
   * @param idCol - The table's id column
   * @param sortOrderCol - The table's sort_order column (reserved for future
   *                      uses such as per-scope renumbering; unused here)
   * @param id - The row's id
   * @param sortOrder - The new absolute sort_order integer
   */
  async setSortOrder(
    table: any,
    idCol: any,
    _sortOrderCol: any,
    id: string,
    sortOrder: number,
  ): Promise<void> {
    await this.database.db
      .update(table)
      .set({ sortOrder })
      .where(withTenant(table, eq(idCol, id)));
  }
}
