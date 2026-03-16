import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const notificationRules = pgTable('notification_rules', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  eventName: text('event_name').notNull(),
  recipientStrategy: text('recipient_strategy').notNull(),
  recipientConfig: jsonb('recipient_config'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
