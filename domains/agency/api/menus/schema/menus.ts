import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

/**
 * menus — top-level containers. Consumers query by slug (e.g. 'primary',
 * 'footer') so the frontend never hard-codes a menu id. Flat entity; the
 * tree lives on menu_items.
 */
export const menus = pgTable('menus', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('menus_slug_unique').on(table.slug),
]);
