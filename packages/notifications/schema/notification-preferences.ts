import { pgTable, text, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { users } from '@packages/database';

export const notificationPreferences = pgTable('notification_preferences', {
  userId: text('user_id').notNull().references(() => users.id),
  channel: text('channel').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
}, (table) => [
  primaryKey({ columns: [table.userId, table.channel] }),
]);
