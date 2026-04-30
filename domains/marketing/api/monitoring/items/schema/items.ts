import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { marketingMonitoringSources } from '../../sources/schema/sources';

/**
 * Items ingested from monitoring sources (Reddit threads, HN comments,
 * RSS articles, etc.).
 *
 * Status state-machine:
 *   new → engaged | dismissed | snoozed | converted_lead
 *   snoozed → new (when snoozed_until passes; computed at query time)
 *   engaged → converted_lead (operator explicitly created a lead from it)
 *
 * Dedup is enforced via the (source_id, external_id) unique index;
 * external_id is the source platform's stable identifier (Reddit thing-id,
 * HN id, RSS guid).
 */
export const marketingMonitoringItems = pgTable(
  'marketing_monitoring_items',
  {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),

    sourceId: text('source_id')
      .notNull()
      .references(() => marketingMonitoringSources.id, { onDelete: 'cascade' }),

    externalId: text('external_id').notNull(),
    url: text('url').notNull(),
    author: text('author'),
    title: text('title'),
    bodyExcerpt: text('body_excerpt'),

    /** Array of keyword IDs that matched this item at ingest time. */
    matchedKeywordIds: text('matched_keyword_ids').array().notNull().default([]),

    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'date' }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),

    status: text('status').notNull().default('new'),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true, mode: 'date' }),
    engagementNote: text('engagement_note'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    deletedBy: text('deleted_by'),
  },
  (table) => [
    uniqueIndex('marketing_monitoring_items_source_external_uniq').on(
      table.sourceId,
      table.externalId,
    ),
    index('marketing_monitoring_items_source_idx').on(table.sourceId),
    index('marketing_monitoring_items_status_idx').on(table.status),
    index('marketing_monitoring_items_posted_at_idx').on(table.postedAt),
    index('marketing_monitoring_items_snoozed_until_idx').on(table.snoozedUntil),
  ],
);

export type MarketingMonitoringItemRow = typeof marketingMonitoringItems.$inferSelect;
export type MarketingMonitoringItemInsert = typeof marketingMonitoringItems.$inferInsert;

export const MONITORING_ITEM_STATUSES = [
  'new',
  'engaged',
  'dismissed',
  'snoozed',
  'converted_lead',
] as const;
export type MonitoringItemStatus = (typeof MONITORING_ITEM_STATUSES)[number];
