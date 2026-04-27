import { pgTable, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { orderableColumns } from '@packages/orderable/schema';
import { softDeleteColumns } from '@packages/soft-delete';
import { features } from './features';

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'),
  assigneeId: text('assignee_id'),
  dueDate: date('due_date', { mode: 'string' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...orderableColumns(),
  ...softDeleteColumns(),
}, (table) => [
  index('tasks_feature_id_idx').on(table.featureId),
  index('tasks_assignee_id_idx').on(table.assigneeId),
  index('tasks_status_idx').on(table.status),
  index('tasks_due_date_idx').on(table.dueDate),
  index('tasks_feature_sort_idx').on(table.featureId, table.sortOrder),
]);
