import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { automationRules } from './automation-rules';

export const automationScheduled = pgTable('automation_scheduled', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  ruleId: text('rule_id').notNull().references(() => automationRules.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  eventPayload: jsonb('event_payload'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'date' }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('automation_scheduled_pending_idx').on(table.scheduledFor).where(sql`sent_at IS NULL`),
]);
