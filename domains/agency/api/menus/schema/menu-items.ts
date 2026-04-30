import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';
import { hierarchyColumns } from '@packages/hierarchy/schema';
import { orderableColumns } from '@packages/orderable/schema';
import { pages } from '../../pages/schema';
import { menus } from './menus';

/**
 * menu_items — hierarchical + orderable entries under a menu. Two-level
 * depth cap is enforced in the menu-items config's hooks (depth 0 = top
 * bar, depth 1 = dropdown). `linkType` selects between a custom URL and a
 * page reference; exactly one of `url` or `pageId` is populated per row,
 * enforced in the service layer since Drizzle doesn't support check
 * constraints cleanly.
 */
export const menuItems = pgTable('menu_items', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  menuId: text('menu_id').notNull().references(() => menus.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  description: text('description'),
  icon: text('icon'),
  linkType: text('link_type').notNull(),
  url: text('url'),
  pageId: text('page_id').references(() => pages.id, { onDelete: 'set null' }),
  target: text('target').notNull().default('_self'),
  ...hierarchyColumns(),
  ...orderableColumns(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('menu_items_menu_id_idx').on(table.menuId),
  index('menu_items_parent_id_idx').on(table.parentId),
]);
