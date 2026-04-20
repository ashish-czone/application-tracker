import { pgTable, text, timestamp, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { softDeleteColumns } from '@packages/soft-delete';

export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  userType: text('user_type'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('roles_name_key').on(table.name).where(sql`deleted_at IS NULL`),
]);
