import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { softDeleteColumns } from '@packages/soft-delete';

export const clients = pgTable('clients', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  email: text('email'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('clients_name_idx').on(table.name),
  index('clients_email_idx').on(table.email),
]);
