import { pgTable, text, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { users } from '@packages/database';

export const credentials = pgTable('credentials', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  identifier: text('identifier').notNull(),
  secretHash: text('secret_hash'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('credentials_provider_identifier_key').on(table.provider, table.identifier),
  check('credentials_secret_hash_check', sql`(${table.provider} = 'password' AND ${table.secretHash} IS NOT NULL) OR (${table.provider} != 'password' AND ${table.secretHash} IS NULL)`),
]);
