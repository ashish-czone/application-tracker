import { text } from 'drizzle-orm/pg-core';

export interface AddressColumnsOptions {
  /**
   * Optional prefix prepended to all generated column names. When empty, base
   * column names are used as-is (e.g. `address_line1`, `city`). When set, the
   * prefix + `_` is prepended (e.g. `billing_address_line1`, `billing_city`).
   * Use prefixes when an entity needs multiple addresses (billing / shipping).
   */
  prefix?: string;
}

const BASE_COLUMNS = ['address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country_id'] as const;

type BaseColumn = typeof BASE_COLUMNS[number];

function snakeToCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function prefixed(prefix: string, base: BaseColumn): string {
  return prefix ? `${prefix}_${base}` : base;
}

/**
 * Drizzle column mixin for address fields. Returns a column map that can be
 * spread into a `pgTable` definition. All columns are nullable `text`. The
 * `country_id` column stores a UUID pointing at the `categories` table
 * (group slug `countries`); the FK is not enforced here to keep this
 * package dependency-free — the consumer can add `.references(() => categories.id)`
 * at the entity level if desired.
 *
 * Usage:
 * ```ts
 * import { addressColumns } from '@packages/address/schema';
 *
 * export const clients = pgTable('clients', {
 *   id: text('id').primaryKey(),
 *   name: text('name').notNull(),
 *   ...addressColumns(),              // address_line1, city, state, ...
 *   ...addressColumns({ prefix: 'billing' }),  // billing_address_line1, billing_city, ...
 * });
 * ```
 */
export function addressColumns(options: AddressColumnsOptions = {}) {
  const prefix = options.prefix ?? '';
  const map: Record<string, ReturnType<typeof text>> = {};
  for (const base of BASE_COLUMNS) {
    const sqlName = prefixed(prefix, base);
    const jsKey = snakeToCamel(sqlName);
    map[jsKey] = text(sqlName);
  }
  return map;
}

/**
 * Returns the list of SQL column names that `addressColumns(options)` produces.
 * Useful for writing validation, form helpers, or drizzle snapshot builders
 * without having to reconstruct column names by hand.
 */
export function addressColumnNames(options: AddressColumnsOptions = {}): string[] {
  const prefix = options.prefix ?? '';
  return BASE_COLUMNS.map((base) => prefixed(prefix, base));
}

export { BASE_COLUMNS as ADDRESS_BASE_COLUMNS };
