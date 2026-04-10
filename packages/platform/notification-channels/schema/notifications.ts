import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';
import { randomUUID } from 'crypto';

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  eventName: text('event_name'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
