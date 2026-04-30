import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const marketingMonitoringSources = pgTable(
  'marketing_monitoring_sources',
  {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),

    kind: text('kind').notNull(),
    label: text('label').notNull(),
    configJson: jsonb('config_json').notNull(),

    pollingCadenceMinutes: integer('polling_cadence_minutes').notNull().default(15),
    isActive: boolean('is_active').notNull().default(true),

    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true, mode: 'date' }),
    lastError: text('last_error'),

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
    index('marketing_monitoring_sources_kind_idx').on(table.kind),
    index('marketing_monitoring_sources_is_active_idx').on(table.isActive),
  ],
);

export type MarketingMonitoringSourceRow = typeof marketingMonitoringSources.$inferSelect;
export type MarketingMonitoringSourceInsert = typeof marketingMonitoringSources.$inferInsert;

export const MONITORING_SOURCE_KINDS = ['reddit', 'hackernews', 'rss'] as const;
export type MonitoringSourceKind = (typeof MONITORING_SOURCE_KINDS)[number];
