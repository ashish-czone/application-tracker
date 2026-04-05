import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  databaseUrl: text('database_url').notNull(),
  status: text('status', { enum: ['active', 'suspended', 'provisioning'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
});
