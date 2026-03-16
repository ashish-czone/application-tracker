import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const notificationTemplates = pgTable('notification_templates', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  channel: text('channel').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});
