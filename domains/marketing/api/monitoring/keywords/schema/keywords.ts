import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { marketingMonitoringSources } from '../../sources/schema/sources';

export const marketingMonitoringKeywords = pgTable(
  'marketing_monitoring_keywords',
  {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),

    sourceId: text('source_id')
      .notNull()
      .references(() => marketingMonitoringSources.id, { onDelete: 'cascade' }),

    phrase: text('phrase').notNull(),
    isRegex: boolean('is_regex').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    deletedBy: text('deleted_by'),
  },
  (table) => [
    index('marketing_monitoring_keywords_source_idx').on(table.sourceId),
    index('marketing_monitoring_keywords_active_idx').on(table.isActive),
  ],
);

export type MarketingMonitoringKeywordRow = typeof marketingMonitoringKeywords.$inferSelect;
export type MarketingMonitoringKeywordInsert = typeof marketingMonitoringKeywords.$inferInsert;
