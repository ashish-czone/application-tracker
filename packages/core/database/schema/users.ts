import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  email: text('email').notNull(),
  phone: text('phone'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  userType: text('user_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
  invitedAt: timestamp('invited_at', { withTimezone: true, mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email).where(sql`deleted_at IS NULL`),
]);
