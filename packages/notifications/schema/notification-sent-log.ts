import { pgTable, text, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { notificationRules } from './notification-rules';

export const notificationSentLog = pgTable('notification_sent_log', {
  ruleId: text('rule_id').notNull().references(() => notificationRules.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  targetDate: date('target_date', { mode: 'string' }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('notification_sent_log_dedup_idx').on(table.ruleId, table.entityType, table.entityId, table.targetDate),
]);
