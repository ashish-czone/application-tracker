import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

/**
 * case_studies — long-form portfolio entries linked from /work and /work/{slug}.
 * Slug is the URL identifier and is enforced unique among non-deleted rows.
 *
 * Body content lives in `body` as plain text/markdown for v1; richer authoring
 * (Puck-per-case-study) is a follow-up. Industry / year / client fields exist
 * to support filtering and meta display on the listing page.
 */
export const caseStudies = pgTable('case_studies', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  client: text('client').notNull(),
  industry: text('industry'),
  year: integer('year'),
  summary: text('summary').notNull(),
  body: text('body'),
  results: text('results'),
  heroImageUrl: text('hero_image_url'),
  ctaText: text('cta_text'),
  ctaHref: text('cta_href'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('case_studies_slug_unique').on(table.slug),
  index('case_studies_display_order_idx').on(table.displayOrder),
  index('case_studies_industry_idx').on(table.industry),
]);
