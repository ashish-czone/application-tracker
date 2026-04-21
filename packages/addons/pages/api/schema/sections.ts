import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { customFieldsColumn } from '@packages/entity-engine/helpers/custom-fields-column';
import type { DataSource } from '@packages/blocks-contract';
import { pages } from './pages';

export const sections = pgTable('sections', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  blockKind: text('block_kind').notNull(),
  variant: text('variant'),
  title: text('title'),
  dataSource: jsonb('data_source').$type<DataSource>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...customFieldsColumn(),
}, (table) => [
  index('sections_page_order_idx').on(table.pageId, table.order),
  index('sections_block_kind_idx').on(table.blockKind),
]);
