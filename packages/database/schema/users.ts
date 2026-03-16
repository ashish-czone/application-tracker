import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  email: text('email').unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  userType: text('user_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
});
