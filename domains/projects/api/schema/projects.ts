import { pgTable, text, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { softDeleteColumns } from '@packages/soft-delete';

export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  ownerId: text('owner_id'),
  status: text('status').notNull().default('planning'),
  priority: text('priority').notNull().default('medium'),
  color: text('color'),
  icon: text('icon'),
  startDate: date('start_date', { mode: 'string' }),
  targetDate: date('target_date', { mode: 'string' }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('projects_slug_unique').on(table.slug),
  index('projects_owner_id_idx').on(table.ownerId),
  index('projects_status_idx').on(table.status),
  index('projects_target_date_idx').on(table.targetDate),
]);
