import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';
import { softDeleteColumns } from '@packages/soft-delete';

export const PAGE_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export const pages = pgTable('pages', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  metaDescription: text('meta_description'),
  ogImage: text('og_image'),
  seo: jsonb('seo').$type<PageSeo>().notNull().default({}),
  status: text('status').notNull().$type<PageStatus>().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('pages_slug_unique').on(table.slug),
  index('pages_created_by_idx').on(table.createdBy),
  index('pages_status_published_at_idx').on(table.status, table.publishedAt),
]);
